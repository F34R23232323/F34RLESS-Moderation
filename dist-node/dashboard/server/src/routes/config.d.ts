import { Router } from 'express';
import type { DashboardContext } from '../context';
import { ConfigValidationError } from '../../../../shared/src/index';
export declare function createConfigRouter(ctx: DashboardContext): Router;
export { ConfigValidationError };
