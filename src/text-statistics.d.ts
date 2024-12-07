declare module 'text-statistics' {
    export default class TextStatistics {
        constructor(text: string);
        fleschKincaidReadingEase(): number;
        fleschKincaidGradeLevel(): number;
        gunningFogScore(): number;
        colemanLiauIndex(): number;
        smogIndex(): number;
        automatedReadabilityIndex(): number;
        textLength(): number;
        letterCount(): number;
        sentenceCount(): number;
        wordCount(): number;
        averageWordsPerSentence(): number;
        averageSyllablesPerWord(): number;
        syllableCount(): number;
    }
}