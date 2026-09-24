import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';

interface EvidenceRow extends RowDataPacket {
  id: number;
  code: string;
  name: string | null;
  content_type: string;
  size: number;
  data: Buffer;
}

/** Public evidence image route (no auth — the random code is the access key,
 *  mirroring /api/archive share links). Serves immutable, cacheable images. */
export function createEvidencePublicRouter(ctx: DashboardContext): Router {
  const router = Router();

  router.get('/:file', async (req, res) => {
    const code = String(req.params.file).replace(/\.[A-Za-z0-9]+$/, '').slice(0, 32);
    const [rows] = await ctx.db.query<EvidenceRow[]>(
      'SELECT id, code, name, content_type, size, data FROM evidence_images WHERE code = ?',
      [code],
    );
    const row = rows[0];
    if (!row || !row.data || row.data.length === 0) {
      res.status(404).json({ error: 'image not found' });
      return;
    }
    const contentType = row.content_type || 'application/octet-stream';
    const safeName = (row.name ?? 'evidence.png').replace(/[^\w.\- ]+/g, '_');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', row.data.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.end(row.data);
  });

  return router;
}
