import type { FastifyInstance } from 'fastify';
import { authenticate, getUserId } from '../lib/auth.js';
import { getSupabaseClient } from '../lib/supabase.js';

const getEnv = (key: string, fallback: string) => {
  return process.env[key] || fallback;
};

const getNumberEnv = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const isUuid = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

export const registerEditorConfigRoutes = (app: FastifyInstance) => {
  app.get('/editor/config.js', async (request, reply) => {
    try {
      const devBypassEnabled = process.env.PIXLLAND_DEV_AUTH_BYPASS === '1';
      const devUserId = process.env.PIXLLAND_DEV_USER_ID || 'anonymous';
      const userId = getUserId(request) || (devBypassEnabled ? devUserId : 'anonymous');

      const { sceneId, projectId, branchId } = request.query as {
        sceneId?: string;
        projectId?: string;
        branchId?: string;
      };

      let sceneRow: any = null;
      let projectRow: any = null;
      let resolvedProjectId: number | null = projectId ? Number(projectId) : null;
      let resolvedBranchId: string | null = isUuid(branchId) ? branchId! : null;
      let resolvedBranchName = 'main';

      // Only query Supabase if it's configured
      let client: any = null;
      try {
        client = getSupabaseClient();
      } catch {
        // Supabase not configured — use local defaults
      }

      if (client && sceneId) {
        const { data, error } = await client
          .from('scenes')
          .select('*')
          .eq('id', Number(sceneId))
          .single();

        if (!error && data) {
          sceneRow = data;
          resolvedProjectId = data.project_id;
          resolvedBranchId = data.branch_id;
        }
      }

      if (client && !resolvedProjectId) {
        const { data: projectData } = await client
          .from('projects')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (projectData?.id) {
          projectRow = projectData;
          resolvedProjectId = projectData.id;
        }
      }

      if (client && resolvedProjectId) {
        const { data, error } = await client
          .from('projects')
          .select('*')
          .eq('id', resolvedProjectId)
          .single();

        if (!error && data) {
          projectRow = data;
        }

        // Resolve a valid branch UUID when none is available from query/scene.
        if (!resolvedBranchId) {
          const { data: branchData } = await client
            .from('branches')
            .select('id, name')
            .eq('project_id', resolvedProjectId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (branchData?.id) {
            resolvedBranchId = branchData.id;
            resolvedBranchName = branchData.name || 'main';
          }
        }

        // If no sceneId was provided, pick the first scene from the project/branch.
        if (!sceneRow) {
          let sceneQuery = client
            .from('scenes')
            .select('*')
            .eq('project_id', resolvedProjectId)
            .order('created_at', { ascending: true })
            .limit(1);

          if (resolvedBranchId) {
            sceneQuery = sceneQuery.eq('branch_id', resolvedBranchId);
          }

          const { data: sceneData } = await sceneQuery.maybeSingle();
          if (sceneData) {
            sceneRow = sceneData;
            resolvedBranchId = sceneData.branch_id || resolvedBranchId;
          }
        }

        // Resolve a real scene when none was provided explicitly. This avoids
        // using the synthetic fallback "default" scene id, which breaks
        // realtime mapping to Supabase rows (and features such as default skybox).
        if (!sceneRow) {
          let sceneQuery = client
            .from('scenes')
            .select('*')
            .eq('project_id', resolvedProjectId)
            .order('created_at', { ascending: true })
            .limit(1);

          if (resolvedBranchId) {
            sceneQuery = sceneQuery.eq('branch_id', resolvedBranchId);
          }

          const { data: sceneData } = await sceneQuery.maybeSingle();
          if (sceneData) {
            sceneRow = sceneData;
            if (!resolvedBranchId && sceneData.branch_id) {
              resolvedBranchId = sceneData.branch_id;
            }
          }
        }
      }

      // O editor sempre roda no proxy (3487), então API calls devem usar /api (relativo)
      // O config-loader busca direto do backend (8788), mas os REST calls do editor
      // são feitos no contexto do navegador (proxy em 3487)
      const apiUrl = '/api';
      const frontendUrl = getEnv('PIXLLAND_FRONTEND_URL', 'http://localhost:3487/');
      const homeUrl = apiUrl; // tips/store e outros endpoints passam pelo proxy
      const staticUrl = getEnv('PIXLLAND_STATIC_URL', frontendUrl);
      const imagesUrl = frontendUrl; // imagens devem vir do proxy/frontend
      const engineUrl = getEnv('PIXLLAND_ENGINE_URL', `${frontendUrl}playcanvas.js`);
      const realtimeHttp = getEnv('PIXLLAND_REALTIME_HTTP', 'ws://localhost:3001');
      const relayWs = getEnv('PIXLLAND_RELAY_WS', 'ws://localhost:3002');
      const messengerWs = getEnv('PIXLLAND_MESSENGER_WS', 'ws://localhost:3003');
      const diskAllowance = getNumberEnv('PIXLLAND_DISK_ALLOWANCE_BYTES', 1073741824);
      const diskUsed = getNumberEnv('PIXLLAND_DISK_USED_BYTES', 0);

      const schema = {
        scene: {
          entities: {
            $of: {
              components: {
                camera: {
                  enabled: { $type: 'boolean', $default: true },
                  clearColor: { $type: ['number'], $default: [0.118, 0.118, 0.118, 1] },
                  clearColorBuffer: { $type: 'boolean', $default: true },
                  clearDepthBuffer: { $type: 'boolean', $default: true },
                  frustumCulling: { $type: 'boolean', $default: true },
                  fov: { $type: 'number', $default: 45 },
                  projection: { $type: 'number', $default: 0 },
                  orthoHeight: { $type: 'number', $default: 4 },
                  nearClip: { $type: 'number', $default: 0.1 },
                  farClip: { $type: 'number', $default: 1000 },
                  priority: { $type: 'number', $default: 0 },
                  rect: { $type: ['number'], $default: [0, 0, 1, 1] },
                  layers: { $type: ['number'], $default: [0, 1, 2, 3, 4] }
                },
                light: {
                  enabled: { $type: 'boolean', $default: true },
                  type: { $type: 'string', $default: 'directional' },
                  color: { $type: ['number'], $default: [1, 1, 1] },
                  intensity: { $type: 'number', $default: 1 },
                  range: { $type: 'number', $default: 8 },
                  innerConeAngle: { $type: 'number', $default: 40 },
                  outerConeAngle: { $type: 'number', $default: 45 },
                  castShadows: { $type: 'boolean', $default: true },
                  shadowDistance: { $type: 'number', $default: 16 },
                  shadowResolution: { $type: 'number', $default: 1024 },
                  shadowBias: { $type: 'number', $default: 0.4 },
                  normalOffsetBias: { $type: 'number', $default: 0.05 },
                  vsmBlurMode: { $type: 'number', $default: 1 },
                  vsmBlurSize: { $type: 'number', $default: 11 },
                  vsmBias: { $type: 'number', $default: 0.01 },
                  cookieAsset: { $type: 'number', $default: null, $editorType: 'asset' },
                  cookieIntensity: { $type: 'number', $default: 1 },
                  cookieFalloff: { $type: 'boolean', $default: true },
                  cookieChannel: { $type: 'string', $default: 'rgb' },
                  cookieAngle: { $type: 'number', $default: 0 },
                  cookieScale: { $type: ['number'], $default: [1, 1] },
                  cookieOffset: { $type: ['number'], $default: [0, 0] },
                  layers: { $type: ['number'], $default: [0] }
                },
                render: {
                  enabled: { $type: 'boolean', $default: true },
                  type: { $type: 'string', $default: 'box' },
                  asset: { $type: 'number', $default: null, $editorType: 'asset' },
                  rootBone: { $type: 'string', $default: null },
                  castShadows: { $type: 'boolean', $default: true },
                  castShadowsLightmap: { $type: 'boolean', $default: true },
                  receiveShadows: { $type: 'boolean', $default: true },
                  isStatic: { $type: 'boolean', $default: false },
                  lightmapped: { $type: 'boolean', $default: false },
                  lightmapSizeMultiplier: { $type: 'number', $default: 1 },
                  customAabb: { $type: 'boolean', $default: false },
                  aabbCenter: { $type: ['number'], $default: [0, 0, 0] },
                  aabbHalfExtents: { $type: ['number'], $default: [0.5, 0.5, 0.5] },
                  batchGroupId: { $type: 'number', $default: null },
                  layers: { $type: ['number'], $default: [0] },
                  materialAssets: { $type: ['number'], $default: [null], $editorType: 'array:asset' }
                },
                model: {
                  enabled: { $type: 'boolean', $default: true },
                  type: { $type: 'string', $default: 'box' },
                  asset: { $type: 'number', $default: null, $editorType: 'asset' },
                  materialAsset: { $type: 'number', $default: null, $editorType: 'asset' },
                  castShadows: { $type: 'boolean', $default: true },
                  castShadowsLightmap: { $type: 'boolean', $default: true },
                  receiveShadows: { $type: 'boolean', $default: true },
                  isStatic: { $type: 'boolean', $default: false },
                  lightmapped: { $type: 'boolean', $default: false },
                  lightmapSizeMultiplier: { $type: 'number', $default: 1 },
                  customAabb: { $type: 'boolean', $default: false },
                  aabbCenter: { $type: ['number'], $default: [0, 0, 0] },
                  aabbHalfExtents: { $type: ['number'], $default: [0.5, 0.5, 0.5] },
                  batchGroupId: { $type: 'number', $default: null },
                  layers: { $type: ['number'], $default: [0] }
                },
                script: {
                  enabled: { $type: 'boolean', $default: true },
                  order: { $type: ['string'], $default: [] },
                  scripts: { $type: 'map', $default: {} }
                }
              }
            }
          },
          settings: {
            physics: {},
            render: {}
          }
        },
        settings: {
          editor: {
            gridDivisions: { $default: 32, $scope: 'projectUser' },
            gridDivisionSize: { $default: 1, $scope: 'projectUser' },
            snapIncrement: { $default: 1, $scope: 'projectUser' },
            gizmoSize: { $default: 1, $scope: 'projectUser' },
            gizmoPreset: { $default: 'default', $scope: 'projectUser' },
            cameraGrabDepth: { $default: false, $scope: 'projectUser' },
            cameraGrabColor: { $default: false, $scope: 'projectUser' },
            cameraNearClip: { $default: 0.1, $scope: 'projectUser' },
            cameraFarClip: { $default: 1000, $scope: 'projectUser' },
            cameraClearColor: { $default: [0.2, 0.2, 0.2, 1], $scope: 'projectUser' },
            cameraToneMapping: { $default: 0, $scope: 'projectUser' },
            cameraGammaCorrection: { $default: 1, $scope: 'projectUser' },
            showFog: { $default: true, $scope: 'projectUser' },
            iconSize: { $default: 1, $scope: 'projectUser' }
          },
          engineV2: { $default: true, $scope: 'project' },
          useLegacyScripts: { $default: false, $scope: 'project' },
          scripts: { $default: [], $scope: 'project' },
          loadingScreenScript: { $default: null, $scope: 'project' }
        },
        asset: {
          type: {
            $enum: []
          }
        },
        materialData: {},
        animstategraphData: {}
      };

      const config = {
        version: 'local',
        accessToken: request.headers.authorization?.replace(/^Bearer\s+/i, '') || '',
        url: {
          api: apiUrl,
          launch: `${frontendUrl.replace(/\/$/, '')}/launch/`,
          home: homeUrl,
          store: `${apiUrl}/store`,
          howdoi: `${apiUrl}/howdoi`,
          frontend: frontendUrl,
          static: staticUrl,
          images: imagesUrl,
          engine: engineUrl,
          useCustomEngine: false,
          realtime: { http: realtimeHttp },
          relay: { ws: relayWs },
          messenger: { ws: messengerWs }
        },
        self: {
          id: userId,
          username: 'local-user',
          branch: {
            id: resolvedBranchId || '',
            name: resolvedBranchName,
            createdAt: new Date().toISOString(),
            latestCheckpointId: null,
            merge: null
          },
          plan: { id: 0, type: 'local' },
          locale: 'en-US',
          flags: {
            tips: {},
            openedEditor: true,
            superUser: false
          }
        },
        owner: {
          id: projectRow?.owner_id || userId,
          username: 'local-owner',
          plan: { id: 0, type: 'local' },
          size: diskUsed,
          diskAllowance
        },
        aws: {
          s3Prefix: ''
        },
        store: {
          sketchfab: {
            clientId: '',
            cookieName: 'sketchfab',
            redirectUrl: `${homeUrl}/oauth/sketchfab`
          }
        },
        project: {
          id: projectRow?.id || resolvedProjectId || 1,
          name: projectRow?.name || 'Untitled Project',
          description: projectRow?.description || '',
          private: projectRow?.private ?? true,
          privateAssets: projectRow?.private ?? true,
          hasPrivateSettings: false,
          thumbnails: {},
          masterBranch: resolvedBranchId || '',
          settings: Object.assign({
            id: 'project_settings_1',
            engineV2: true,
            useLegacyScripts: false
          }, projectRow?.settings || {}),
          permissions: {
            read: [userId],
            write: [userId],
            admin: [userId]
          }
        },
        scene: {
          id: sceneRow?.id || 1,
          uniqueId: sceneRow?.unique_id || 'default',
          name: sceneRow?.name || 'Main Scene'
        },
        engineVersions: {
          current: { version: 'local', description: 'Local' },
          force: { version: 'local', description: 'Local' }
        },
        sentry: { enabled: false },
        metrics: { env: 'local', send: false },
        oneTrustDomainKey: '',
        schema,
        wasmModules: []
      };

      const js = `window.config = ${JSON.stringify(config)};`;
      reply.type('application/javascript').send(js);
    } catch (err) {
      reply.code(500).send('/* server_error */');
    }
  });
};
