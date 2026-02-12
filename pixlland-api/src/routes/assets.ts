import type { FastifyInstance } from 'fastify';
import { authenticate, getUserId } from '../lib/auth.js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';
import { broadcastMessenger } from '../lib/messenger-client.js';

type AssetFile = {
  filename: string;
  size: number;
  mime: string;
  url: string;
  storagePath: string;
};

const getAssetsBucket = () => process.env.SUPABASE_ASSETS_BUCKET || 'assets';

const safeJsonParse = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizePath = (value: unknown) => {
  return Array.isArray(value) ? value : [];
};

const getAssetPath = (asset: { path?: unknown; data?: Record<string, unknown> | null }) => {
  if (asset && Array.isArray(asset.path)) {
    return asset.path;
  }

  return normalizePath(asset?.data?.path);
};

const getAssetPreload = (asset: { preload?: unknown; data?: Record<string, unknown> | null }) => {
  if (typeof asset?.preload === 'boolean') {
    return asset.preload;
  }

  const preload = asset?.data?.preload;
  return typeof preload === 'boolean' ? preload : true;
};

const getAssetSource = (asset: { source?: unknown; data?: Record<string, unknown> | null }) => {
  if (typeof asset?.source === 'boolean') {
    return asset.source;
  }

  const source = asset?.data?.source;
  return typeof source === 'boolean' ? source : true;
};

const buildPathFromParent = async (parentId: number | null) => {
  if (!parentId) {
    return [];
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('assets')
    .select('*')
    .eq('id', parentId)
    .single();

  if (error || !data) {
    return [];
  }

  const parentPath = getAssetPath(data);
  return parentPath.concat([parentId]);
};

const buildFileUrl = (assetId: number, filename: string) => {
  return `/api/assets/${assetId}/file/${encodeURIComponent(filename)}`;
};

const signStorageUrl = async (storagePath: string) => {
  const client = getSupabaseClient();
  const bucket = getAssetsBucket();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
};

const buildCopyName = (name: string) => {
  if (!name) {
    return 'Copy';
  }

  const match = name.match(/^(.*)\sCopy(?:\s(\d+))?$/);
  if (!match) {
    return `${name} Copy`;
  }

  const base = match[1];
  const index = Number(match[2] || '1');
  return `${base} Copy ${index + 1}`;
};

const copyAssetFileInfo = (asset: any, newId: number) => {
  if (!asset?.file || typeof asset.file !== 'object') {
    return null;
  }

  const filename = asset.file.filename || asset.file.name;
  if (!filename) {
    return null;
  }

  return {
    ...asset.file,
    filename,
    url: buildFileUrl(newId, filename)
  };
};

const duplicateAssetTree = async (
  client: ReturnType<typeof getSupabaseClient>,
  rootAssetId: number,
  branchId: string,
  parentId: number | null
) => {
  const { data: root, error: rootError } = await client
    .from('assets')
    .select('*')
    .eq('id', rootAssetId)
    .single();

  if (rootError || !root) {
    throw new Error('asset_not_found');
  }

  const rootPath = getAssetPath(root);
  const rootPrefix = rootPath.concat([root.id]);

  const { data: projectAssets, error: listError } = await client
    .from('assets')
    .select('*')
    .eq('project_id', root.project_id)
    .eq('branch_id', branchId)
    .limit(5000);

  if (listError) {
    throw new Error(listError.message);
  }

  const assets = projectAssets || [];
  const descendants = assets
    .filter((row) => {
      const path = getAssetPath(row);
      if (path.length < rootPrefix.length) {
        return false;
      }

      for (let i = 0; i < rootPrefix.length; i++) {
        if (path[i] !== rootPrefix[i]) {
          return false;
        }
      }

      return row.id !== root.id;
    })
    .sort((a, b) => getAssetPath(a).length - getAssetPath(b).length);

  const nextRootPath = parentId ? await buildPathFromParent(parentId) : [];
  const oldToNew = new Map<number, number>();
  const createdIds: number[] = [];

  const insertClone = async (source: any, sourceParentId: number | null, explicitName?: string) => {
    const mappedParent = sourceParentId === null
      ? null
      : (oldToNew.get(sourceParentId) ?? sourceParentId);

    const path = mappedParent ? await buildPathFromParent(mappedParent) : [];
    const sourceData = (source.data && typeof source.data === 'object' && !Array.isArray(source.data)) ? source.data : {};
    const clonedData = {
      ...sourceData,
      path,
      parentId: mappedParent
    };

    const { data: inserted, error: insertError } = await client
      .from('assets')
      .insert({
        project_id: source.project_id,
        branch_id: branchId,
        owner_id: source.owner_id,
        name: explicitName || source.name,
        type: source.type,
        data: clonedData,
        file: null
      })
      .select('*')
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message || 'asset_duplicate_failed');
    }

    const fileInfo = copyAssetFileInfo(source, inserted.id);
    if (fileInfo) {
      await client
        .from('assets')
        .update({ file: fileInfo })
        .eq('id', inserted.id);
    }

    oldToNew.set(source.id, inserted.id);
    createdIds.push(inserted.id);
    return inserted;
  };

  const duplicatedRoot = await insertClone(root, parentId, buildCopyName(root.name));

  for (const child of descendants) {
    const childPath = getAssetPath(child);
    const oldParentId = childPath[childPath.length - 1] ?? null;
    await insertClone(child, oldParentId);
  }

  return {
    root: duplicatedRoot,
    createdIds,
    rootPath: nextRootPath
  };
};

const resolveAssetOwnerId = async (projectId: number, userId: string) => {
  const client = getSupabaseClient();

  const { data: projectRow } = await client
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectRow?.owner_id && typeof projectRow.owner_id === 'string') {
    return projectRow.owner_id;
  }

  return userId;
};

export const registerAssetRoutes = (app: FastifyInstance) => {
  const emptyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  );
  app.get('/assets', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const { data, error } = await client
        .from('assets')
        .select('*')
        .eq('owner_id', userId)
        .limit(50);

      if (error) {
        return reply.code(500).send({ error: error.message });
      }

      return { result: data };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.post('/assets', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const parts = request.parts();
      const fields: Record<string, string> = {};
      let filePart: { filename: string; mimetype: string; toBuffer: () => Promise<Buffer> } | null = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          filePart = {
            filename: part.filename,
            mimetype: part.mimetype,
            toBuffer: () => part.toBuffer()
          };
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      const projectId = Number(fields.projectId || '');
      const branchId = fields.branchId || null;
      const parentId = fields.parent ? Number(fields.parent) : null;
      const name = fields.name || fields.filename || filePart?.filename || '';
      const type = fields.type || '';

      if (!projectId || !branchId || !name || !type) {
        return reply.code(400).send({ error: 'missing_required_fields' });
      }

      const dataPayload = safeJsonParse(fields.data) || {};
      const path = await buildPathFromParent(parentId);
      const preload = fields.preload === undefined ? undefined : fields.preload === 'true';
      const source = fields.source === undefined ? undefined : fields.source === 'true';
      const ownerId = await resolveAssetOwnerId(projectId, userId);

      const storedData = {
        ...dataPayload,
        path,
        parentId,
        ...(preload === undefined ? {} : { preload }),
        ...(source === undefined ? {} : { source })
      };

      const { data: assetRow, error: insertError } = await client
        .from('assets')
        .insert({
          project_id: projectId,
          branch_id: branchId,
          name,
          type,
          owner_id: ownerId,
          data: storedData
        })
        .select('*')
        .single();

      if (insertError || !assetRow) {
        return reply.code(500).send({ error: insertError?.message || 'asset_create_failed' });
      }

      let fileInfo: AssetFile | null = null;
      if (filePart) {
        const buffer = await filePart.toBuffer();
        const filename = fields.filename || filePart.filename;
        const storagePath = `${projectId}/${branchId}/${assetRow.id}/${filename}`;
        const { error: uploadError } = await client.storage
          .from(getAssetsBucket())
          .upload(storagePath, buffer, {
            upsert: true,
            contentType: filePart.mimetype || 'application/octet-stream'
          });

        if (uploadError) {
          return reply.code(500).send({ error: uploadError.message });
        }

        fileInfo = {
          filename,
          size: buffer.length,
          mime: filePart.mimetype || 'application/octet-stream',
          url: buildFileUrl(assetRow.id, filename),
          storagePath
        };

        const { error: updateError } = await client
          .from('assets')
          .update({ file: fileInfo })
          .eq('id', assetRow.id);

        if (updateError) {
          return reply.code(500).send({ error: updateError.message });
        }
      }

      const resultAsset = {
        id: assetRow.id,
        uniqueId: assetRow.id,
        name: assetRow.name,
        type: assetRow.type,
        tags: [],
        meta: {},
        data: storedData,
        file: fileInfo || assetRow.file || null,
        path,
        preload: preload ?? true,
        has_thumbnail: false,
        source: source ?? true,
        source_asset_id: null,
        createdAt: assetRow.created_at
      };

      // Broadcast to editor clients via messenger
      broadcastMessenger('asset.new', {
        asset: {
          id: String(assetRow.id),
          branchId: branchId,
          type: assetRow.type,
          source: source ?? true,
          status: 'complete',
          source_asset_id: null,
          createdAt: assetRow.created_at
        }
      });

      return resultAsset;
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.put('/assets/:assetId', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const { assetId } = request.params as { assetId: string };
      const assetIdValue = Number(assetId);
      if (!assetIdValue) {
        return reply.code(400).send({ error: 'invalid_asset_id' });
      }

      const parts = request.parts();
      const fields: Record<string, string> = {};
      let filePart: { filename: string; mimetype: string; toBuffer: () => Promise<Buffer> } | null = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          filePart = {
            filename: part.filename,
            mimetype: part.mimetype,
            toBuffer: () => part.toBuffer()
          };
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      const updates: Record<string, any> = {};
      const parentId = fields.parent ? Number(fields.parent) : null;
      const nextPath = fields.parent ? await buildPathFromParent(parentId) : null;

      let dataPayload: Record<string, any> | null = null;
      if (fields.data) {
        dataPayload = safeJsonParse(fields.data);
      }
      if (fields.preload !== undefined) {
        dataPayload = dataPayload || {};
        dataPayload.preload = fields.preload === 'true';
      }
      if (fields.source !== undefined) {
        dataPayload = dataPayload || {};
        dataPayload.source = fields.source === 'true';
      }
      if (nextPath) {
        const { data: existing } = await client
          .from('assets')
          .select('*')
          .eq('id', assetIdValue)
          .single();

        const baseData = dataPayload || existing?.data || {};
        dataPayload = {
          ...baseData,
          path: nextPath,
          parentId
        };
      }
      if (fields.name) {
        updates.name = fields.name;
      }
      if (fields.type) {
        updates.type = fields.type;
      }
      if (dataPayload) {
        updates.data = dataPayload;
      }

      const { data: existing, error: existingError } = await client
        .from('assets')
        .select('*')
        .eq('id', assetIdValue)
        .single();

      if (existingError || !existing) {
        return reply.code(404).send({ error: 'asset_not_found' });
      }

      if (filePart) {
        const buffer = await filePart.toBuffer();
        const filename = fields.filename || filePart.filename;
        const storagePath = `${existing.project_id}/${existing.branch_id}/${assetIdValue}/${filename}`;
        const { error: uploadError } = await client.storage
          .from(getAssetsBucket())
          .upload(storagePath, buffer, {
            upsert: true,
            contentType: filePart.mimetype || 'application/octet-stream'
          });

        if (uploadError) {
          return reply.code(500).send({ error: uploadError.message });
        }

        updates.file = {
          filename,
          size: buffer.length,
          mime: filePart.mimetype || 'application/octet-stream',
          url: buildFileUrl(assetIdValue, filename),
          storagePath
        };
      }

      if (Object.keys(updates).length === 0) {
        return reply.send(existing);
      }

      const { data, error } = await client
        .from('assets')
        .update(updates)
        .eq('id', assetIdValue)
        .select('*')
        .single();

      if (error) {
        return reply.code(500).send({ error: error.message });
      }

      return data;
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/assets/:assetId', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { assetId } = request.params as { assetId: string };
      const { data, error } = await client
        .from('assets')
        .select('*')
        .eq('id', Number(assetId))
        .single();

      if (error || !data) {
        return reply.code(404).send({ error: 'asset_not_found' });
      }

      const filename = data.file?.filename || data.file?.name || data.name;
      const fileUrl = filename ? buildFileUrl(data.id, filename) : null;

      const path = getAssetPath(data);
      const preload = getAssetPreload(data);
      const source = getAssetSource(data);

      return {
        id: data.id,
        uniqueId: data.id,
        name: data.name,
        type: data.type,
        tags: [],
        meta: data.meta || {},
        data: data.data || {},
        file: data.file || (fileUrl ? { filename, url: fileUrl } : null),
        path,
        preload,
        has_thumbnail: false,
        source,
        source_asset_id: data.source_asset_id || null,
        createdAt: data.created_at
      };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.post('/assets/:assetId/reimport', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };
    const assetIdValue = Number(assetId);
    if (!assetIdValue) {
      return reply.code(400).send({ error: 'invalid_asset_id' });
    }

    return {
      ok: true,
      id: assetIdValue,
      status: 'complete'
    };
  });

  app.post('/assets/:assetId/duplicate', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { assetId } = request.params as { assetId: string };
      const assetIdValue = Number(assetId);
      if (!assetIdValue) {
        return reply.code(400).send({ error: 'invalid_asset_id' });
      }

      const body = (request.body || {}) as { branchId?: string };
      const { data: existing, error: existingError } = await client
        .from('assets')
        .select('branch_id')
        .eq('id', assetIdValue)
        .single();

      if (existingError || !existing) {
        return reply.code(404).send({ error: 'asset_not_found' });
      }

      const branchId = body.branchId || existing.branch_id;
      const duplicated = await duplicateAssetTree(client, assetIdValue, branchId, null);

      return {
        id: duplicated.root.id,
        uniqueId: duplicated.root.id,
        branchId,
        created: duplicated.createdIds
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message || 'server_error' });
    }
  });

  app.post('/assets/paste', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const body = (request.body || {}) as {
        branchId?: string;
        targetBranchId?: string;
        assets?: string[];
        targetParentId?: number | null;
      };

      const sourceIds = (body.assets || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
      if (!sourceIds.length) {
        return reply.code(400).send({ error: 'missing_assets' });
      }

      const { data: roots, error: rootsError } = await client
        .from('assets')
        .select('id, branch_id')
        .in('id', sourceIds)
        .limit(sourceIds.length);

      if (rootsError || !roots?.length) {
        return reply.code(404).send({ error: 'assets_not_found' });
      }

      const branchId = body.targetBranchId || body.branchId || roots[0].branch_id;
      const targetParentId = typeof body.targetParentId === 'number' ? body.targetParentId : null;
      const created: number[] = [];

      for (const root of roots) {
        const duplicated = await duplicateAssetTree(client, root.id, branchId, targetParentId);
        created.push(...duplicated.createdIds);
      }

      return {
        ok: true,
        created
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message || 'server_error' });
    }
  });

  app.get('/assets/:assetId/thumbnail/:size', async (_request, reply) => {
    reply.type('image/png').send(emptyPng);
  });

  app.get('/assets/:assetId/thumbnail', async (_request, reply) => {
    reply.type('image/png').send(emptyPng);
  });

  app.get('/assets/:assetId/file/:filename', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const bucket = getAssetsBucket();
      const { assetId, filename } = request.params as { assetId: string; filename: string };
      const assetIdValue = Number(assetId);
      if (!assetIdValue) {
        return reply.code(400).send({ error: 'invalid_asset_id' });
      }

      const { data, error } = await client
        .from('assets')
        .select('*')
        .eq('id', assetIdValue)
        .single();

      if (error || !data) {
        return reply.code(404).send({ error: 'asset_not_found' });
      }

      const storagePath = data.file?.storagePath || `${data.project_id}/${data.branch_id}/${assetIdValue}/${filename}`;

      // Download the file and stream it directly to avoid CORS redirect issues
      const { data: fileData, error: dlError } = await client.storage.from(bucket).download(storagePath);
      if (dlError || !fileData) {
        return reply.code(404).send({ error: 'file_not_found' });
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const mime = data.file?.mime || 'application/octet-stream';
      return reply
        .header('Content-Type', mime)
        .header('Content-Length', buffer.length)
        .header('Cache-Control', 'public, max-age=3600')
        .send(buffer);
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/assets/:assetId/download', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { assetId } = request.params as { assetId: string };
      const assetIdValue = Number(assetId);
      if (!assetIdValue) {
        return reply.code(400).send({ error: 'invalid_asset_id' });
      }

      const { data, error } = await client
        .from('assets')
        .select('*')
        .eq('id', assetIdValue)
        .single();

      if (error || !data || !data.file?.storagePath) {
        return reply.code(404).send({ error: 'file_not_found' });
      }

      const signedUrl = await signStorageUrl(data.file.storagePath);
      if (!signedUrl) {
        return reply.code(404).send({ error: 'file_not_found' });
      }

      return reply.redirect(signedUrl);
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });
};
