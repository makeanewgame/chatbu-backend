import { en } from './en';
import { tr } from './tr';

export class Language {
    public static translate = (text: string, lang: string) => {
        const langMap = {
            en,
            tr
        };

        if (langMap.hasOwnProperty(lang)) {
            return langMap[lang][text];
        } else {
            console.log(`Language '${lang}' is not supported.`);
            return null;
        }
    }
}