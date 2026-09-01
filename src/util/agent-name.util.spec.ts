import { formatAgentPublicName } from './agent-name.util';

describe('formatAgentPublicName', () => {
    it('full first name + surname initial', () => {
        expect(formatAgentPublicName('Ahmet Efeoğlu')).toBe('Ahmet E.');
        expect(formatAgentPublicName('Ayça Nur')).toBe('Ayça N.');
    });

    it('uses the LAST token as the surname', () => {
        expect(formatAgentPublicName('Ahmet Emre Yılmaz')).toBe('Ahmet Y.');
    });

    it('uppercases the initial with Turkish locale (i -> İ)', () => {
        expect(formatAgentPublicName('Deniz ipek')).toBe('Deniz İ.');
    });

    it('single token passes through', () => {
        expect(formatAgentPublicName('Ahmet')).toBe('Ahmet');
    });

    it('collapses extra whitespace', () => {
        expect(formatAgentPublicName('  Ahmet   Efeoğlu  ')).toBe('Ahmet E.');
    });

    it('nullish / empty -> undefined', () => {
        expect(formatAgentPublicName(null)).toBeUndefined();
        expect(formatAgentPublicName(undefined)).toBeUndefined();
        expect(formatAgentPublicName('   ')).toBeUndefined();
    });
});
