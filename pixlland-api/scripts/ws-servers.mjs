import 'dotenv/config';
import fs from 'fs/promises';
import { WebSocketServer } from 'ws';
import ShareDB from 'sharedb';
import { createClient } from '@supabase/supabase-js';
import { Duplex } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';

const REALTIME_PORT = 3001;
const RELAY_PORT = 3002;
const MESSENGER_PORT = 3003;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SKYBOX_ENABLED = process.env.PIXLLAND_DEFAULT_SKYBOX !== '0';
const DEFAULT_SKYBOX_ASSET_NAME = 'Pixlland Default Skybox';
const DEFAULT_SKYBOX_FILENAME = 'pixlland-default-skybox-env-atlas.png';
const DEFAULT_SKYBOX_SOURCE_FILE = path.resolve(__dirname, '../../engine/examples/assets/cubemaps/helipad-env-atlas.png');

const DEFAULT_PROJECT_SETTINGS = {
  engineV2: true,
  useLegacyScripts: false,
  scripts: [],
  loadingScreenScript: null,
  editor: {
    gridDivisions: 32,
    gridDivisionSize: 1,
    snapIncrement: 1,
    gizmoSize: 1,
    gizmoPreset: 'default',
    cameraGrabDepth: false,
    cameraGrabColor: false,
    cameraNearClip: 0.1,
    cameraFarClip: 1000,
    cameraClearColor: [0.2, 0.2, 0.2, 1],
    cameraToneMapping: 0,
    cameraGammaCorrection: 1,
    showFog: true,
    iconSize: 1
  }
};

const DEFAULT_PROJECT_ONLY_SETTINGS = {
  engineV2: true,
  useLegacyScripts: false,
  scripts: [],
  loadingScreenScript: null
};

const DEFAULT_PROJECT_USER_SETTINGS = {
  editor: {
    ...DEFAULT_PROJECT_SETTINGS.editor
  },
  branch: null,
  favoriteBranches: []
};

const DEFAULT_USER_SETTINGS = {
  editor: {
    ...DEFAULT_PROJECT_SETTINGS.editor
  }
};

const DEFAULT_SCENE_SETTINGS = {
  physics: {
    gravity: [0, -9.8, 0]
  },
  render: {
    fog_end: 1000,
    fog_start: 1,
    global_ambient: [0.3, 0.3, 0.3],  // Aumentado para melhor iluminação ambiente
    fog_color: [0, 0, 0],
    fog: 'none',
    fog_density: 0.01,
    gamma_correction: 1,  // GAMMA_SRGB para cores corretas
    tonemapping: 0,  // TONEMAP_LINEAR
    exposure: 1.2,  // Aumentado levemente para objetos mais visíveis
    skyboxIntensity: 1,
    skyboxRotation: [0, 0, 0],
    skyboxMip: 0,
    lightmapSizeMultiplier: 16,
    lightmapMaxResolution: 2048,
    lightmapMode: 1
  }
};

const DEFAULT_SCENE_ENTITIES = {
  root: {
    name: 'Root',
    parent: null,
    resource_id: 'root',
    tags: [],
    enabled: true,
    components: {},
    scale: [1, 1, 1],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    children: ['camera', 'light']
  },
  camera: {
    name: 'Camera',
    parent: 'root',
    resource_id: 'camera',
    tags: [],
    enabled: true,
    components: {
      camera: {
        fov: 45,
        projection: 0,
        clearColor: [0.22, 0.34, 0.52, 1],
        clearColorBuffer: true,
        clearDepthBuffer: true,
        frustumCulling: true,
        enabled: true,
        orthoHeight: 4,
        farClip: 1000,
        nearClip: 0.1,
        priority: 0,
        rect: [0, 0, 1, 1],
        layers: [0, 1, 2, 3, 4]
      }
    },
    scale: [1, 1, 1],
    position: [4, 3.5, 4],
    rotation: [-30, 45, 0],
    children: []
  },
  light: {
    name: 'Directional Light',
    parent: 'root',
    resource_id: 'light',
    tags: [],
    enabled: true,
    components: {
      light: {
        enabled: true,
        bake: false,
        bakeDir: true,
        affectDynamic: true,
        affectLightmapped: false,
        isStatic: false,
        color: [1, 1, 1],
        intensity: 1.5,  // Aumentado para melhor iluminação
        type: 'directional',
        shadowDistance: 40,  // Aumentado para sombras mais distantes
        range: 8,
        innerConeAngle: 40,
        outerConeAngle: 45,
        shape: 0,
        falloffMode: 0,
        castShadows: true,
        shadowUpdateMode: 2,
        shadowType: 1,  // PCF 3x3 para sombras melhores
        shadowResolution: 2048,  // Resolução maior para sombras mais nítidas
        shadowBias: 0.2,  // Bias ajustado
        normalOffsetBias: 0.05,
        vsmBlurMode: 1,
        vsmBlurSize: 11,
        vsmBias: 0.01,
        cookieAsset: null,
        cookieIntensity: 1,
        cookieFalloff: true,
        cookieChannel: 'rgb',
        cookieAngle: 0,
        cookieScale: [1, 1],
        cookieOffset: [0, 0],
        layers: [0]
      }
    },
    scale: [1, 1, 1],
    position: [3, 5, -3],  // Posição mais alta e otimizada
    rotation: [45, 45, 0],  // Ângulo padrão clássico de iluminação
    children: []
  }
};

const toText = (data) => (typeof data === 'string' ? data : data.toString());

const toNumericIdList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((id) => Number.isInteger(id) && id > 0);
};

const getAssetPathFromRow = (row) => {
  if (Array.isArray(row?.path)) {
    return row.path;
  }

  if (row?.data && typeof row.data === 'object' && !Array.isArray(row.data) && Array.isArray(row.data.path)) {
    return row.data.path;
  }

  return [];
};

const startsWithPath = (pathValue, prefix) => {
  if (!Array.isArray(pathValue) || !Array.isArray(prefix)) {
    return false;
  }

  if (pathValue.length < prefix.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i++) {
    if (pathValue[i] !== prefix[i]) {
      return false;
    }
  }

  return true;
};

const createSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

const getAssetsBucket = () => process.env.SUPABASE_ASSETS_BUCKET || 'assets';

const isUuid = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const skyboxAssetCache = new Map();

const DEFAULT_SKYBOX_DATA = {
  name: DEFAULT_SKYBOX_ASSET_NAME,
  textures: [null, null, null, null, null, null],
  type: 'rgbp',
  minFilter: 1,
  magFilter: 1,
  anisotropy: 1,
  rgbm: false,
  mipmaps: false
};

const ensureDefaultSkyboxAsset = async ({ supabase, projectId, branchId, ownerId }) => {
  if (!DEFAULT_SKYBOX_ENABLED || !supabase) {
    return null;
  }

  const cacheKey = `${projectId}:${branchId}`;
  if (skyboxAssetCache.has(cacheKey)) {
    return skyboxAssetCache.get(cacheKey);
  }

  try {
    // Find existing asset
    const { data: existing } = await supabase
      .from('assets')
      .select('id, file')
      .eq('project_id', projectId)
      .eq('branch_id', branchId)
      .eq('type', 'cubemap')
      .eq('name', DEFAULT_SKYBOX_ASSET_NAME)
      .maybeSingle();

    let assetId = existing?.id || null;

    let resolvedOwnerId = isUuid(ownerId) ? ownerId : null;
    if (!resolvedOwnerId) {
      const { data: projectOwner } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle();
      if (isUuid(projectOwner?.owner_id)) {
        resolvedOwnerId = projectOwner.owner_id;
      }
    }

    if (!resolvedOwnerId) {
      console.warn('[realtime] default skybox: missing valid owner_id; skipping asset insert');
      return null;
    }

    if (!assetId) {
      const { data: inserted, error: insertError } = await supabase
        .from('assets')
        .insert({
          project_id: projectId,
          branch_id: branchId,
          owner_id: resolvedOwnerId,
          name: DEFAULT_SKYBOX_ASSET_NAME,
          type: 'cubemap',
          // Minimal cubemap data; the env atlas file provides the actual prefiltered map.
          data: DEFAULT_SKYBOX_DATA
        })
        .select('id')
        .single();

      if (insertError || !inserted?.id) {
        console.warn('[realtime] default skybox: asset insert failed', insertError?.message || insertError);
        return null;
      }

      assetId = inserted.id;
    }

    // Ensure file exists in storage (upload once)
    const storagePath = `${projectId}/${branchId}/${assetId}/${DEFAULT_SKYBOX_FILENAME}`;

    // If file already recorded on asset, assume it's uploaded.
    const hasFileRecorded = !!existing?.file?.storagePath && existing?.file?.filename === DEFAULT_SKYBOX_FILENAME;

    if (!hasFileRecorded) {
      const buffer = await fs.readFile(DEFAULT_SKYBOX_SOURCE_FILE);
      const bucket = getAssetsBucket();
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          upsert: true,
          contentType: 'image/png'
        });

      if (uploadError) {
        console.warn('[realtime] default skybox: upload failed', uploadError.message || uploadError);
        return null;
      }

      const fileInfo = {
        filename: DEFAULT_SKYBOX_FILENAME,
        size: buffer.length,
        mime: 'image/png',
        url: `/api/assets/${assetId}/file/${encodeURIComponent(DEFAULT_SKYBOX_FILENAME)}`,
        storagePath
      };

      const { error: updateError } = await supabase
        .from('assets')
        .update({ file: fileInfo })
        .eq('id', assetId);

      if (updateError) {
        console.warn('[realtime] default skybox: file update failed', updateError.message || updateError);
        // not fatal; file exists in storage
      }
    }

    const currentData = existing?.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
      ? existing.data
      : {};
    const needsDataUpdate =
      currentData.type !== DEFAULT_SKYBOX_DATA.type ||
      currentData.minFilter !== DEFAULT_SKYBOX_DATA.minFilter ||
      currentData.magFilter !== DEFAULT_SKYBOX_DATA.magFilter ||
      currentData.mipmaps !== DEFAULT_SKYBOX_DATA.mipmaps ||
      currentData.rgbm !== DEFAULT_SKYBOX_DATA.rgbm ||
      !Array.isArray(currentData.textures);

    if (needsDataUpdate) {
      const { error: dataUpdateError } = await supabase
        .from('assets')
        .update({ data: { ...currentData, ...DEFAULT_SKYBOX_DATA } })
        .eq('id', assetId);

      if (dataUpdateError) {
        console.warn('[realtime] default skybox: data update failed', dataUpdateError.message || dataUpdateError);
      }
    }

    skyboxAssetCache.set(cacheKey, assetId);
    return assetId;
  } catch (err) {
    console.warn('[realtime] default skybox: unexpected error', err);
    return null;
  }
};

const isPlainObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value);
};

const mergeDefaults = (target, defaults) => {
  if (Array.isArray(defaults)) {
    return Array.isArray(target) ? target : defaults;
  }

  if (!isPlainObject(defaults)) {
    return target ?? defaults;
  }

  const output = isPlainObject(target) ? { ...target } : {};

  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];
    const existingValue = output[key];

    if (existingValue === undefined || existingValue === null) {
      output[key] = defaultValue;
    } else if (isPlainObject(defaultValue)) {
      output[key] = mergeDefaults(existingValue, defaultValue);
    }
  }

  return output;
};

const ensureDoc = (connection, collection, id, data) => new Promise((resolve) => {
  const doc = connection.get(collection, id.toString());
  doc.fetch((err) => {
    if (err) {
      console.error(`[realtime] fetch error ${collection}:${id}`, err);
      resolve();
      return;
    }
    if (doc.type) {
      resolve();
      return;
    }
    doc.create(data, 'json0', (createErr) => {
      if (createErr) {
        console.error(`[realtime] create error ${collection}:${id}`, createErr);
      }
      resolve();
    });
  });
});

const getSettingsDefaultsById = (id) => {
  const settingsId = String(id || '');

  if (settingsId.startsWith('project_settings_')) {
    return DEFAULT_PROJECT_ONLY_SETTINGS;
  }

  if (settingsId.startsWith('project_')) {
    return DEFAULT_PROJECT_USER_SETTINGS;
  }

  if (settingsId.startsWith('user_')) {
    return DEFAULT_USER_SETTINGS;
  }

  if (settingsId.startsWith('project-private_')) {
    return {};
  }

  return DEFAULT_PROJECT_ONLY_SETTINGS;
};

const ensureSettingsDoc = (connection, id) => new Promise((resolve) => {
  const settingsId = String(id || '');
  const defaults = getSettingsDefaultsById(settingsId);
  const doc = connection.get('settings', settingsId);

  doc.fetch((err) => {
    if (err) {
      console.error(`[realtime] fetch error settings:${settingsId}`, err);
      resolve();
      return;
    }

    if (!doc.type) {
      doc.create(defaults, 'json0', (createErr) => {
        if (createErr) {
          console.error(`[realtime] create error settings:${settingsId}`, createErr);
        }
        resolve();
      });
      return;
    }

    const current = isPlainObject(doc.data) ? doc.data : {};
    const next = mergeDefaults(current, defaults);

    if (JSON.stringify(current) === JSON.stringify(next)) {
      resolve();
      return;
    }

    doc.submitOp([{ p: [], od: current, oi: next }], (opErr) => {
      if (opErr) {
        console.error(`[realtime] patch error settings:${settingsId}`, opErr);
      }
      resolve();
    });
  });
});

const ensureSceneDoc = (connection, scene) => new Promise((resolve) => {
  const sceneId = (scene.unique_id || scene.id).toString();
  const doc = connection.get('scenes', sceneId);

  doc.fetch((err) => {
    if (err) {
      console.error(`[realtime] fetch error scenes:${sceneId}`, err);
      resolve();
      return;
    }

    const baseData = {
      item_id: scene.id,
      branch_id: scene.branch_id || 'local',
      name: scene.name || 'Main Scene',
      entities: DEFAULT_SCENE_ENTITIES,
      settings: DEFAULT_SCENE_SETTINGS
    };

    const getDefaultSkyboxAssetId = async () => {
      if (!DEFAULT_SKYBOX_ENABLED) {
        return null;
      }

      const supabase = createSupabaseClient();
      if (!supabase) {
        return null;
      }

      try {
        const sceneKey = sceneId;

        // Prefer lookup by unique_id (string), fallback to numeric id if possible.
        let sceneRow = null;
        const { data: byUnique } = await supabase
          .from('scenes')
          .select('project_id, branch_id, owner_id')
          .eq('unique_id', sceneKey)
          .maybeSingle();
        sceneRow = byUnique || null;

        if (!sceneRow && /^\d+$/.test(sceneKey)) {
          const { data: byId } = await supabase
            .from('scenes')
            .select('project_id, branch_id, owner_id')
            .eq('id', Number(sceneKey))
            .maybeSingle();
          sceneRow = byId || null;
        }

        if (!sceneRow?.project_id) {
          return null;
        }

        const projectId = sceneRow.project_id;
        let branchId = isUuid(sceneRow.branch_id) ? sceneRow.branch_id : (isUuid(scene.branch_id) ? scene.branch_id : null);

        if (!branchId) {
          const { data: branchRow } = await supabase
            .from('branches')
            .select('id')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (branchRow?.id) {
            branchId = branchRow.id;
          }
        }

        if (!branchId) {
          return null;
        }

        const ownerId = sceneRow.owner_id || 'anonymous';
        return await ensureDefaultSkyboxAsset({ supabase, projectId, branchId, ownerId });
      } catch {
        return null;
      }
    };

    if (!doc.type) {
      (async () => {
        const skyboxAssetId = await getDefaultSkyboxAssetId();
        if (skyboxAssetId) {
          baseData.settings = baseData.settings || {};
          baseData.settings.render = baseData.settings.render || {};
          if (!baseData.settings.render.skybox) {
            baseData.settings.render.skybox = skyboxAssetId;
          }
        }
      })().finally(() => {
        doc.create(baseData, 'json0', (createErr) => {
          if (createErr) {
            console.error(`[realtime] create error scenes:${sceneId}`, createErr);
          }
          resolve();
        });
      });
      return;
    }

    const currentSettings = doc.data?.settings || {};
    const nextSettings = mergeDefaults(currentSettings, DEFAULT_SCENE_SETTINGS);
    const hasEntities = doc.data?.entities && Object.keys(doc.data.entities).length > 0;
    const nextEntities = hasEntities ? doc.data.entities : DEFAULT_SCENE_ENTITIES;

    const ops = [];
    if (JSON.stringify(nextSettings) !== JSON.stringify(currentSettings)) {
      ops.push({ p: ['settings'], od: currentSettings, oi: nextSettings });
    }

    if (JSON.stringify(nextEntities) !== JSON.stringify(doc.data?.entities || {})) {
      ops.push({ p: ['entities'], od: doc.data?.entities, oi: nextEntities });
    }

    (async () => {
      if (DEFAULT_SKYBOX_ENABLED) {
        const skyboxAssetId = await getDefaultSkyboxAssetId();
        if (skyboxAssetId) {
          const effectiveSettings = ops.find((op) => op.p.length === 1 && op.p[0] === 'settings')?.oi || nextSettings;
          const effectiveRender = isPlainObject(effectiveSettings?.render) ? effectiveSettings.render : {};

          if (effectiveRender.skybox !== skyboxAssetId) {
            const withSkyboxSettings = {
              ...effectiveSettings,
              render: {
                ...effectiveRender,
                skybox: skyboxAssetId
              }
            };

            const settingsOpIndex = ops.findIndex((op) => op.p.length === 1 && op.p[0] === 'settings');
            if (settingsOpIndex >= 0) {
              ops[settingsOpIndex] = {
                p: ['settings'],
                od: ops[settingsOpIndex].od,
                oi: withSkyboxSettings
              };
            } else {
              ops.push({ p: ['settings'], od: currentSettings, oi: withSkyboxSettings });
            }
          }
        }
      }

      if (!ops.length) {
        resolve();
        return;
      }

      doc.submitOp(ops, (opErr) => {
        if (opErr) {
          console.error(`[realtime] patch error scenes:${sceneId}`, opErr);
        }
        resolve();
      });
    })();
  });
});

const seedDocsFromSupabase = async (backend) => {
  const client = createSupabaseClient();
  if (!client) {
    console.log('[realtime] Supabase not configured, skipping seed');
    return;
  }

  const connection = backend.connect();
  const [scenes, assets] = await Promise.all([
    client.from('scenes').select('*').limit(200),
    client.from('assets').select('*').limit(500)
  ]);

  if (scenes.error) {
    console.error('[realtime] failed to load scenes', scenes.error);
  } else if (scenes.data) {
    await Promise.all(scenes.data.map((scene) => ensureSceneDoc(connection, scene)));
  }

  if (assets.error) {
    console.error('[realtime] failed to load assets', assets.error);
  } else if (assets.data) {
    console.log(`[realtime] seeding ${assets.data.length} asset docs into ShareDB`);
    await Promise.all(assets.data.map((asset) => ensureDoc(connection, 'assets', asset.id, {
      item_id: asset.id,
      branch_id: asset.branch_id,
      name: asset.name,
      type: asset.type,
      file: asset.file || {},
      data: asset.data || {},
      tags: [],
      path: [],
      preload: true,
      has_thumbnail: false,
      source: true,
      source_asset_id: null
    })));
  }
};

const fetchAssetFromDb = async (assetId) => {
  const client = createSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('assets')
      .select('*')
      .eq('id', Number(assetId))
      .single();
    if (error || !data) return null;
    return {
      item_id: data.id,
      branch_id: data.branch_id || 'local',
      name: data.name,
      type: data.type,
      file: data.file || {},
      data: data.data || {},
      tags: [],
      path: Array.isArray(data.data?.path) ? data.data.path : [],
      preload: typeof data.data?.preload === 'boolean' ? data.data.preload : true,
      has_thumbnail: false,
      source: typeof data.data?.source === 'boolean' ? data.data.source : true,
      source_asset_id: data.source_asset_id || null
    };
  } catch {
    return null;
  }
};

const messengerClients = new Set();

const broadcastMessengerEvent = (name, data) => {
  const payload = JSON.stringify({ name, data });
  for (const client of messengerClients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
};

const applyFsMove = async ({ ids, to }, backend) => {
  const client = createSupabaseClient();
  const moveIds = toNumericIdList(ids);
  if (!client || !moveIds.length) {
    return [];
  }

  const { data: movingRows, error: movingError } = await client
    .from('assets')
    .select('*')
    .in('id', moveIds)
    .limit(moveIds.length);

  if (movingError || !movingRows?.length) {
    return [];
  }

  const projectId = movingRows[0].project_id;
  const branchId = movingRows[0].branch_id;

  const { data: allRows, error: listError } = await client
    .from('assets')
    .select('*')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .limit(5000);

  if (listError || !allRows) {
    return [];
  }

  const movingSet = new Set(movingRows.map((row) => row.id));
  const movingRoots = movingRows.filter((row) => {
    const path = getAssetPathFromRow(row);
    return !path.some((ancestorId) => movingSet.has(ancestorId));
  });

  let targetRow = null;
  if (to !== null && to !== undefined) {
    const targetId = Number(to);
    targetRow = allRows.find((row) => row.id === targetId) || null;
  }

  const targetPath = targetRow ? getAssetPathFromRow(targetRow).concat([targetRow.id]) : [];
  const patches = [];

  for (const root of movingRoots) {
    const oldRootPath = getAssetPathFromRow(root);
    const oldPrefix = oldRootPath.concat([root.id]);
    const newRootPath = [...targetPath];

    const descendants = allRows.filter((row) => startsWithPath(getAssetPathFromRow(row), oldPrefix));

    for (const row of [root, ...descendants]) {
      const rowPath = getAssetPathFromRow(row);
      const suffix = startsWithPath(rowPath, oldPrefix) ? rowPath.slice(oldPrefix.length) : [];
      const nextPath = row.id === root.id
        ? newRootPath
        : newRootPath.concat([root.id], suffix);

      const nextParentId = nextPath.length ? nextPath[nextPath.length - 1] : null;
      const nextData = {
        ...(row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {}),
        path: nextPath,
        parentId: nextParentId
      };

      await client
        .from('assets')
        .update({ data: nextData })
        .eq('id', row.id);

      patches.push({
        uniqueId: row.id,
        path: nextPath
      });
    }
  }

  if (backend && patches.length) {
    const connection = backend.connect();
    for (const patch of patches) {
      const doc = connection.get('assets', String(patch.uniqueId));
      await new Promise((resolve) => {
        doc.fetch((err) => {
          if (err || !doc.type) {
            resolve();
            return;
          }

          const currentPath = Array.isArray(doc.data?.path) ? doc.data.path : [];
          const currentData = (doc.data?.data && typeof doc.data.data === 'object' && !Array.isArray(doc.data.data)) ? doc.data.data : {};
          const currentDataPath = Array.isArray(currentData.path) ? currentData.path : [];

          const operations = [];
          if (JSON.stringify(currentPath) !== JSON.stringify(patch.path)) {
            operations.push({ p: ['path'], od: currentPath, oi: patch.path });
          }
          if (JSON.stringify(currentDataPath) !== JSON.stringify(patch.path)) {
            operations.push({ p: ['data', 'path'], od: currentDataPath, oi: patch.path });
          }

          if (!operations.length) {
            resolve();
            return;
          }

          doc.submitOp(operations, () => resolve());
        });
      });
    }
  }

  return patches;
};

const applyFsDelete = async ({ ids }) => {
  const client = createSupabaseClient();
  const deleteIds = toNumericIdList(ids);
  if (!client || !deleteIds.length) {
    return [];
  }

  const { data: roots, error: rootsError } = await client
    .from('assets')
    .select('*')
    .in('id', deleteIds)
    .limit(deleteIds.length);

  if (rootsError || !roots?.length) {
    return [];
  }

  const projectId = roots[0].project_id;
  const branchId = roots[0].branch_id;

  const { data: allRows, error: allError } = await client
    .from('assets')
    .select('*')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .limit(5000);

  if (allError || !allRows) {
    return [];
  }

  const toDeleteSet = new Set();
  for (const root of roots) {
    toDeleteSet.add(root.id);
    if (root.type === 'folder') {
      const prefix = getAssetPathFromRow(root).concat([root.id]);
      for (const row of allRows) {
        if (startsWithPath(getAssetPathFromRow(row), prefix)) {
          toDeleteSet.add(row.id);
        }
      }
    }
  }

  const toDelete = Array.from(toDeleteSet);
  if (!toDelete.length) {
    return [];
  }

  await client
    .from('assets')
    .delete()
    .in('id', toDelete);

  return toDelete;
};

const applyFsDuplicate = async ({ ids }) => {
  const client = createSupabaseClient();
  const duplicateIds = toNumericIdList(ids);
  if (!client || !duplicateIds.length) {
    return [];
  }

  const { data: sourceRows, error: sourceError } = await client
    .from('assets')
    .select('*')
    .in('id', duplicateIds)
    .limit(duplicateIds.length);

  if (sourceError || !sourceRows?.length) {
    return [];
  }

  const createdAssets = [];

  for (const source of sourceRows) {
    const sourceData = (source.data && typeof source.data === 'object' && !Array.isArray(source.data)) ? source.data : {};
    const clonedData = {
      ...sourceData,
      path: getAssetPathFromRow(source),
      parentId: sourceData.parentId ?? (getAssetPathFromRow(source).length ? getAssetPathFromRow(source).slice(-1)[0] : null)
    };

    const { data: inserted, error: insertError } = await client
      .from('assets')
      .insert({
        project_id: source.project_id,
        branch_id: source.branch_id,
        owner_id: source.owner_id,
        name: `${source.name} Copy`,
        type: source.type,
        data: clonedData,
        file: source.file || null
      })
      .select('id, branch_id, type, created_at')
      .single();

    if (!insertError && inserted?.id) {
      createdAssets.push(inserted);
    }
  }

  return createdAssets;
};

const createShareDbStream = (socket) => {
  const stream = new Duplex({ objectMode: true });
  stream._ended = false;

  stream._read = () => {};
  stream._write = (data, _encoding, callback) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(data));
    }
    callback();
  };

  stream.safePush = (data) => {
    if (!stream._ended) {
      stream.push(data);
    }
  };

  socket.on('close', () => {
    stream._ended = true;
    stream.push(null);
  });

  return stream;
};

const createRealtimeServer = async (port) => {
  const backend = new ShareDB();
  await seedDocsFromSupabase(backend);

  const wss = new WebSocketServer({ port });
  const clients = new Set();

  wss.on('connection', (socket) => {
    clients.add(socket);
    console.log(`[realtime] new client connected (total: ${clients.size})`);

    const stream = createShareDbStream(socket);
    backend.listen(stream);

    socket.on('message', async (raw) => {
      const data = toText(raw);

      if (data.startsWith('auth')) {
        console.log('[realtime] client authenticated');
        socket.send(`auth${JSON.stringify({ ok: true })}`);
        return;
      }

      if (data.startsWith('selection')) {
        for (const client of clients) {
          if (client !== socket && client.readyState === client.OPEN) {
            client.send(data);
          }
        }
        return;
      }

      if (data.startsWith('fs')) {
        try {
          const payload = JSON.parse(data.slice(2));
          if (!payload || typeof payload !== 'object') {
            return;
          }

          if (payload.op === 'move') {
            const patches = await applyFsMove(payload, backend);
            if (patches.length) {
              const message = `fs:paths:${JSON.stringify(patches)}`;
              for (const client of clients) {
                if (client.readyState === client.OPEN) {
                  client.send(message);
                }
              }
            }
            return;
          }

          if (payload.op === 'delete') {
            const deletedIds = await applyFsDelete(payload);
            if (deletedIds.length) {
              broadcastMessengerEvent('assets.delete', {
                assets: deletedIds.map((id) => String(id))
              });
            }
            return;
          }

          if (payload.op === 'duplicate') {
            const createdAssets = await applyFsDuplicate(payload);
            for (const asset of createdAssets) {
              broadcastMessengerEvent('asset.new', {
                asset: {
                  id: String(asset.id),
                  branchId: asset.branch_id || 'local',
                  type: asset.type || 'unknown',
                  source: true,
                  status: 'complete',
                  source_asset_id: null,
                  createdAt: asset.created_at || new Date().toISOString()
                }
              });
            }
            return;
          }
        } catch (err) {
          console.warn('[realtime] failed to process fs message', err);
          return;
        }
      }

      if (!data.startsWith('{') && !data.startsWith('[')) {
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !msg.a) {
        return;
      }

      const allowedActions = new Set([
        'hs', 'qf', 'qs', 'qu', 'bf', 'bs', 'bu', 'f', 's', 'u', 'op', 'nf', 'nt', 'p', 'ps', 'pu'
      ]);
      if (!allowedActions.has(msg.a)) {
        return;
      }

      if (msg && (msg.a === 's' || msg.a === 'f') && msg.c && msg.d) {
        console.log(`[realtime] on-demand doc request: collection=${msg.c} id=${msg.d} action=${msg.a}`);
        if (msg.c === 'scenes') {
          await ensureSceneDoc(backend.connect(), {
            id: msg.d,
            unique_id: msg.d,
            branch_id: 'local',
            name: `Scene ${msg.d}`
          });
        }
        if (msg.c === 'assets') {
          console.log(`[realtime] on-demand asset doc request for id=${msg.d}`);
          const realData = await fetchAssetFromDb(msg.d);
          console.log(`[realtime] fetchAssetFromDb(${msg.d}):`, realData ? 'found' : 'NOT FOUND');
          await ensureDoc(backend.connect(), 'assets', msg.d, realData || {
            item_id: msg.d,
            branch_id: 'local',
            name: `Asset ${msg.d}`,
            type: 'unknown',
            file: {},
            data: {},
            tags: [],
            path: [],
            preload: true,
            has_thumbnail: false,
            source: true,
            source_asset_id: null
          });
        }
        if (msg.c === 'settings') {
          console.log(`[realtime] on-demand settings doc request for id=${msg.d}`);
          await ensureSettingsDoc(backend.connect(), msg.d);
        }
        if (msg.c === 'user_data') {
          console.log(`[realtime] on-demand user_data doc request for id=${msg.d}`);
          await ensureDoc(backend.connect(), 'user_data', msg.d, {});
        }
      }

      stream.safePush(msg);
    });

    socket.on('close', () => {
      clients.delete(socket);
    });
  });

  wss.on('listening', () => {
    console.log(`[ws] realtime listening on ws://localhost:${port}`);
  });
};

const createRelayServer = (port) => {
  const wss = new WebSocketServer({ port });
  const rooms = new Map();
  const clients = new Map();
  let nextUserId = 1;

  const joinRoom = (socket, roomName) => {
    let room = rooms.get(roomName);
    if (!room) {
      room = new Set();
      rooms.set(roomName, room);
    }

    room.add(socket);
    clients.get(socket)?.rooms.add(roomName);

    const users = Array.from(room)
      .map((client) => clients.get(client)?.id)
      .filter((id) => typeof id === 'number');

    socket.send(JSON.stringify({ t: 'room:join', name: roomName, users }));

    for (const client of room) {
      if (client !== socket && client.readyState === client.OPEN) {
        client.send(JSON.stringify({ t: 'room:join', name: roomName, userId: clients.get(socket)?.id }));
      }
    }
  };

  const leaveRoom = (socket, roomName) => {
    const room = rooms.get(roomName);
    if (!room) {
      return;
    }

    room.delete(socket);
    clients.get(socket)?.rooms.delete(roomName);
    const userId = clients.get(socket)?.id;

    for (const client of room) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ t: 'room:leave', name: roomName, userId }));
      }
    }

    if (room.size === 0) {
      rooms.delete(roomName);
    }
  };

  const broadcastRoom = (socket, roomName, msg) => {
    const room = rooms.get(roomName);
    if (!room) {
      return;
    }

    for (const client of room) {
      if (client !== socket && client.readyState === client.OPEN) {
        client.send(JSON.stringify(msg));
      }
    }
  };

  wss.on('connection', (socket) => {
    const id = nextUserId++;
    clients.set(socket, { id, rooms: new Set() });

    socket.send(JSON.stringify({ t: 'welcome', userId: id }));

    socket.on('message', (raw) => {
      const data = toText(raw);
      if (data === 'ping') {
        socket.send('pong');
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (!msg || !msg.t) {
        return;
      }

      if (msg.t === 'room:join' && msg.name) {
        joinRoom(socket, msg.name);
        return;
      }

      if (msg.t === 'room:leave' && msg.name) {
        leaveRoom(socket, msg.name);
        return;
      }

      if (msg.t === 'room:msg' && msg.name) {
        if (msg.to) {
          for (const [client, info] of clients.entries()) {
            if (info.id === msg.to && client.readyState === client.OPEN) {
              client.send(JSON.stringify(msg));
              return;
            }
          }
          return;
        }
        broadcastRoom(socket, msg.name, msg);
      }
    });

    socket.on('close', () => {
      const info = clients.get(socket);
      if (info) {
        for (const roomName of info.rooms) {
          leaveRoom(socket, roomName);
        }
      }
      clients.delete(socket);
    });
  });

  wss.on('listening', () => {
    console.log(`[ws] relay listening on ws://localhost:${port}`);
  });
};

const createMessengerServer = (port) => {
  const wss = new WebSocketServer({ port });
  const clients = messengerClients;
  let nextUserId = 1;

  wss.on('connection', (socket) => {
    clients.add(socket);
    const id = nextUserId++;
    socket.send(JSON.stringify({ name: 'welcome', userId: id }));

    socket.on('message', (raw) => {
      const data = toText(raw);
      if (data === 'ping') {
        socket.send('pong');
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (!msg || !msg.name) {
        return;
      }

      if (msg.name === 'authenticate') {
        socket.send(JSON.stringify({ name: 'welcome', userId: id }));
        return;
      }

      for (const client of clients) {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(msg));
        }
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
    });
  });

  wss.on('listening', () => {
    console.log(`[ws] messenger listening on ws://localhost:${port}`);
  });
};

await createRealtimeServer(REALTIME_PORT);
createRelayServer(RELAY_PORT);
createMessengerServer(MESSENGER_PORT);
