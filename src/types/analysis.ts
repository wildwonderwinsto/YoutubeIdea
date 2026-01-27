/**
 * Video analysis types and interfaces
 */

export interface AnalysisJobStatus {
    status: 'processing' | 'complete' | 'error' | 'not_found';
    progress?: number;
    step?: string;
    duration?: number;
    error?: string;
    result?: AnalysisResult;
    updatedAt?: string;
}

export interface AnalysisResult {
    biggestProblem: string;
    viralScore: number;
    subscores: {
        hook: SubScore;
        pacing: SubScore;
        visualVariety: SubScore;
        emotionalImpact: SubScore;
        clarity: SubScore;
        ctas: SubScore;
    };
    editPlan: EditInstruction[];
    packaging: PackagingSuggestions;
    checklist: string[];
}

export interface SubScore {
    score: number;
    why: string;
}

export interface EditInstruction {
    timestamp: string; // e.g., "[0:00-0:15]"
    action: string;
    visual: string;
    audio: string;
    goal: string;
}

export interface PackagingSuggestions {
    titles: string[];
    thumbnails: string[];
    audience: string[];
}
