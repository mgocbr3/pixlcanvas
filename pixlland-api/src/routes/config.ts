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

export const registerEditorConfigRoutes = (app: FastifyInstance) => {
  app.get('/editor/config.js', async (request, reply) => {
    try {
      const userId = getUserId(request) || 'anonymous';

      const client = getSupabaseClient();
      const { sceneId, projectId, branchId } = request.query as {
        sceneId?: string;
        projectId?: string;
        branchId?: string;
      };

      let sceneRow: any = null;
      let projectRow: any = null;
      let resolvedProjectId: number | null = projectId ? Number(projectId) : null;
      let resolvedBranchId: string | null = branchId || null;

      if (sceneId) {
        const { data, error } = await client
          .from('scenes')
          .select('*')
          .eq('id', Number(sceneId))
          .single();

        if (error) {
          return reply.code(404).send('/* scene_not_found */');
        }

        sceneRow = data;
        resolvedProjectId = data.project_id;
        resolvedBranchId = data.branch_id;
      }

      if (resolvedProjectId) {
        const { data, error } = await client
          .from('projects')
          .select('*')
          .eq('id', resolvedProjectId)
          .single();

        if (error) {
          return reply.code(404).send('/* project_not_found */');
        }

        projectRow = data;
      }

      const apiUrl = getEnv('PIXLLAND_API_URL', 'http://localhost:8787');
      const homeUrl = getEnv('PIXLLAND_HOME_URL', 'http://localhost:8787');
      const frontendUrl = getEnv('PIXLLAND_FRONTEND_URL', 'http://localhost:3487/');
      const staticUrl = getEnv('PIXLLAND_STATIC_URL', frontendUrl);
      const imagesUrl = getEnv('PIXLLAND_IMAGES_URL', apiUrl);
      const engineUrl = getEnv('PIXLLAND_ENGINE_URL', `${frontendUrl}playcanvas.js`);
      const realtimeHttp = getEnv('PIXLLAND_REALTIME_HTTP', 'http://localhost:3001');
      const relayWs = getEnv('PIXLLAND_RELAY_WS', 'ws://localhost:3002');
      const messengerWs = getEnv('PIXLLAND_MESSENGER_WS', 'ws://localhost:3003');
      const diskAllowance = getNumberEnv('PIXLLAND_DISK_ALLOWANCE_BYTES', 1073741824);
      const diskUsed = getNumberEnv('PIXLLAND_DISK_USED_BYTES', 0);

      const schema = {
        scene: {
          entities: {
            $of: {
              components: {
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
          store: `${homeUrl}/store`,
          howdoi: `${homeUrl}/howdoi`,
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
            id: resolvedBranchId || 'main',
            name: 'main',
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
          id: projectRow?.id || resolvedProjectId || 0,
          name: projectRow?.name || 'Untitled Project',
          description: projectRow?.description || '',
          private: projectRow?.private ?? true,
          privateAssets: projectRow?.private ?? true,
          hasPrivateSettings: false,
          thumbnails: {},
          masterBranch: resolvedBranchId || 'main',
          settings: projectRow?.settings || {
            engineV2: true,
            useLegacyScripts: false
          },
          permissions: {
            read: [userId],
            write: [userId],
            admin: [userId]
          }
        },
        scene: {
          id: sceneRow?.id || null,
          uniqueId: sceneRow?.unique_id || null,
          name: sceneRow?.name || null
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
