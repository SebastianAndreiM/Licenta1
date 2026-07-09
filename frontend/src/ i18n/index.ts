import {ro} from './ro';
import {en} from './en';

export type Language = 'ro' | 'en';
export type {TranslationKeys} from './ro';

export const translations = { ro, en };
export {ro, en};
