// ============================================================
// MangaScans — Shared Package Entry Point
// ============================================================

// Types & Enums
export {
    ProjectStatus,
    PageStatus,
    UserPlan,
    TranslationStyle,
    TargetLanguage,
    WsEvent,
    RegisterSchema,
    LoginSchema,
    CreateProjectSchema,
    UpdateBubblesSchema,
} from './types';

export type {
    BoundingBox,
    Bubble,
    IUser,
    IProject,
    IPage,
    PageJobPayload,
    PipelineResult,
    ApiResponse,
    PaginatedResponse,
    WsProgressPayload,
} from './types';

// Database
export { UserModel, ProjectModel, PageModel, connectDB } from './db';

// Storage
export {
    uploadFile,
    downloadFile,
    getPresignedUrl,
    deleteFile,
    listFiles,
    pageStorageKey,
} from './storage';

// Queue
export {
    getRedisConnection,
    getPageQueue,
    createPageWorker,
    getQueueEvents,
    cacheTranslation,
    getCachedTranslation,
    QUEUE_NAMES,
} from './queue';
