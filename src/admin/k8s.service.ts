import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as https from 'https';

const K8S_API = 'https://kubernetes.default.svc';
const NAMESPACE = 'chatbu';
const TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

// Maps health-check service name → K8s resources
const SERVICE_MAP: Record<string, { deployment: string; labelSelector: string } | null> = {
    'fastapi-gateway': { deployment: 'fastapi-gateway', labelSelector: 'app=fastapi-gateway' },
    'ml-services': { deployment: 'ml-services', labelSelector: 'app=ml-services' },
    'minio': { deployment: 'rustfs', labelSelector: 'app=rustfs' },
    'postgresql': null, // managed RDS — no restart
};

@Injectable()
export class K8sService {
    private readonly logger = new Logger(K8sService.name);

    constructor(private readonly httpService: HttpService) { }

    private getHeaders(): Record<string, string> {
        const token = fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
        return { Authorization: `Bearer ${token}` };
    }

    private getHttpsAgent(): https.Agent {
        const ca = fs.existsSync(CA_PATH) ? fs.readFileSync(CA_PATH) : undefined;
        return new https.Agent({ ca, rejectUnauthorized: !!ca });
    }

    private isInCluster(): boolean {
        return fs.existsSync(TOKEN_PATH);
    }

    /** Restart a deployment by patching its restartedAt annotation */
    async restartDeployment(serviceName: string): Promise<{ message: string }> {
        if (!this.isInCluster()) {
            return { message: 'K8s API not available (running outside cluster)' };
        }

        const svc = SERVICE_MAP[serviceName];
        if (!svc) {
            return { message: `Service "${serviceName}" does not support restart` };
        }

        const url = `${K8S_API}/apis/apps/v1/namespaces/${NAMESPACE}/deployments/${svc.deployment}`;
        const patch = {
            spec: {
                template: {
                    metadata: {
                        annotations: {
                            'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                        },
                    },
                },
            },
        };

        await firstValueFrom(
            this.httpService.patch(url, patch, {
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/strategic-merge-patch+json',
                },
                httpsAgent: this.getHttpsAgent(),
            })
        );

        this.logger.log(`Restarted deployment ${svc.deployment} in ${NAMESPACE}`);
        return { message: `Deployment "${svc.deployment}" restart initiated` };
    }

    /** Fetch last N log lines from all pods of a service */
    async getPodLogs(serviceName: string, tailLines = 50): Promise<{ pods: Array<{ name: string; logs: string }> }> {
        if (!this.isInCluster()) {
            return { pods: [{ name: 'local', logs: 'K8s API not available (running outside cluster)' }] };
        }

        const svc = SERVICE_MAP[serviceName];
        if (!svc) {
            return { pods: [{ name: serviceName, logs: 'No K8s pods for this service' }] };
        }

        // List pods by label selector
        const listUrl = `${K8S_API}/api/v1/namespaces/${NAMESPACE}/pods?labelSelector=${encodeURIComponent(svc.labelSelector)}`;
        const listResp = await firstValueFrom(
            this.httpService.get(listUrl, {
                headers: this.getHeaders(),
                httpsAgent: this.getHttpsAgent(),
            })
        );

        const pods: any[] = listResp.data?.items ?? [];
        const results: Array<{ name: string; logs: string }> = [];

        for (const pod of pods) {
            const podName: string = pod.metadata?.name;
            if (!podName) continue;

            try {
                const logUrl = `${K8S_API}/api/v1/namespaces/${NAMESPACE}/pods/${podName}/log?tailLines=${tailLines}&timestamps=false`;
                const logResp = await firstValueFrom(
                    this.httpService.get(logUrl, {
                        headers: this.getHeaders(),
                        httpsAgent: this.getHttpsAgent(),
                        responseType: 'text',
                    })
                );
                results.push({ name: podName, logs: logResp.data as string });
            } catch (err) {
                results.push({ name: podName, logs: `Log fetch error: ${err?.message}` });
            }
        }

        return { pods: results };
    }
}
