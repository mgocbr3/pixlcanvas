# Diagnóstico: Problema de Renderização Translúcida

## Problema Reportado
Objetos 3D aparecem translúcidos/estranhos no viewport

## Possíveis Causas

### 1. **Material com BlendType Incorreto**
- Se materiais estão usando `BLEND_NORMAL`, `BLEND_ADDITIVE` ou outro modo, eles renderizam com transparência
- **Solução**: Materiais opacos devem usar `blendType: BLEND_NONE` (valor 0)

### 2. **Lighting Desabilitado**
- Se `useLighting: false` nos materiais, objetos não recebem iluminação
- O editor cria materiais de gizmo com `useLighting: false`, mas objetos da cena precisam de luz
- **Solução**: Garantir que materiais tenham `useLighting: true`

### 3. **Configurações de Gamma/Tonemap Inconsistentes**
- Se gamma correction está configurado mas aplicado incorretamente
- Se tonemapping está desabilitado quando deveria estar ativo
- **Sintomas**: Cores "lavadas", objetos parecendo fantasmas, contraste ruim

### 4. **Ausência de Luz na Cena**
- Se não há nenhuma luz ativa (Directional/Omni/Spot)
- **Resultado**: Objetos renderizam apenas com cor ambiente (muito escura)

### 5. **Scene Settings Incorretos**
- `ambientLight` muito fraco ou [0,0,0]
- `exposure` muito baixo
- `skybox` não configurado (sem reflexões)

## Checklist de Diagnóstico

Execute no **Console do Editor** (F12):

```javascript
// 1. Verificar luzes na cena
const lights = pc.Application.getApplication().root.findComponents('light');
console.log('Luzes na cena:', lights.length);
lights.forEach(l => {
    console.log(`- ${l.entity.name}: tipo=${l.type}, enabled=${l.enabled}, intensity=${l.intensity}, color=`, l.color);
});

// 2. Verificar configurações de cena
const scene = pc.Application.getApplication().scene;
console.log('Scene Settings:', {
    ambientLight: scene.ambientLight,
    exposure: scene.exposure,
    skyboxIntensity: scene.skyboxIntensity,
    skyboxMip: scene.skyboxMip
});

// 3. Verificar câmera editor
const camera = editor.call('camera:current');
if (camera && camera.camera) {
    console.log('Camera Settings:', {
        toneMapping: camera.camera.toneMapping,
        gammaCorrection: camera.camera.gammaCorrection,
        clearColor: camera.camera.clearColor
    });
}

// 4. Verificar materiais na cena (sample)
const renders = pc.Application.getApplication().root.findComponents('render');
console.log('Render Components:', renders.length);
renders.slice(0, 3).forEach(r => {
    const mi = r.meshInstances[0];
    if (mi && mi.material) {
        const mat = mi.material;
        console.log(`Material ${mat.name || 'unnamed'}:`, {
            blendType: mat.blendType,
            useLighting: mat.useLighting,
            useTonemap: mat.useTonemap,
            opacity: mat.opacity,
            diffuse: mat.diffuse,
            emissive: mat.emissive
        });
    }
});
```

## Soluções Rápidas

### A. Adicionar Luz Directional (se não existir)
No editor, menu **Entity > Light > Directional Light**

Ou via API:
```javascript
const light = new pc.Entity('Directional Light');
light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 1, 1),
    intensity: 1,
    castShadows: true
});
light.setEulerAngles(45, 45, 0);
pc.Application.getApplication().root.addChild(light);
```

### B. Corrigir Scene Settings
```javascript
const scene = pc.Application.getApplication().scene;
scene.ambientLight.set(0.2, 0.2, 0.2); // luz ambiente sutil
scene.exposure = 1.0;
```

### C. Verificar Material Default
Quando objetos são criados, o material deve ser:
```javascript
const material = new pc.StandardMaterial();
material.diffuse.set(0.7, 0.7, 0.7); // cor cinza claro
material.useLighting = true;
material.useTonemap = true;
material.useSkybox = true;
material.blendType = pc.BLEND_NONE; // OPACO
material.update();
```

### D. Ajustar Câmera do Editor
```javascript
const camera = editor.call('camera:current');
if (camera && camera.camera) {
    camera.camera.gammaCorrection = pc.GAMMA_SRGB; // ou 1
    camera.camera.toneMapping = pc.TONEMAP_LINEAR; // ou 0
}
editor.call('viewport:render');
```

## Arquivos Relevantes

- `/pixlland-api/scripts/ws-servers.mjs` - Scene defaults (linha 28-100)
- `/editor/src/editor/viewport/viewport-scene-settings.ts` - Apply scene settings
- `/editor/src/editor/viewport/viewport-color-material.ts` - Material helper (gizmos)

## Valores Corretos de Referência

### Gamma Correction
- `pc.GAMMA_NONE = 0` - Sem correção (cores saturadas)
- `pc.GAMMA_SRGB = 1` - Correção sRGB (recomendado)

### Tone Mapping
- `pc.TONEMAP_LINEAR = 0` - Sem tonemap (default simples)
- `pc.TONEMAP_FILMIC = 1` - Filmic curve
- `pc.TONEMAP_ACES = 3` - ACES (cinema quality)

### Blend Type
- `pc.BLEND_NONE = 0` - Opaco (default)
- `pc.BLEND_NORMAL = 1` - Transparência normal
- `pc.BLEND_ADDITIVE = 2` - Aditivo (luzes, efeitos)

## Próximos Passos

1. **Execute o checklist acima no console**
2. **Capture os valores retornados**
3. **Verifique se há pelo menos 1 luz na cena**
4. **Confirme que materials têm `useLighting: true`**
5. **Ajuste scene.ambientLight se estiver [0,0,0]**

Se após isso ainda houver problemas, me envie:
- Screenshot do problema
- Output do checklist do console
- Lista de entities na cena (Hierarchy panel)
