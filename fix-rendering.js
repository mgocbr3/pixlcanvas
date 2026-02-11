/**
 * Script de correção rápida para problemas de renderização
 * 
 * Como usar:
 * 1. Abra o Console do navegador (F12) com o editor aberto
 * 2. Cole este script inteiro
 * 3. Digite: fixRendering()
 */

function fixRendering() {
    const app = pc.Application.getApplication();
    const scene = app.scene;
    
    console.log('🔧 Iniciando correção de renderização...');
    
    // 1. Verificar e adicionar luz se necessário
    const lights = app.root.findComponents('light');
    console.log(`📊 Luzes encontradas: ${lights.length}`);
    
    let hasDirectional = false;
    lights.forEach(light => {
        if (light.type === 'directional' && light.enabled) {
            hasDirectional = true;
            console.log(`✅ Luz direcional encontrada: ${light.entity.name}`);
        }
    });
    
    if (!hasDirectional) {
        console.log('⚠️  Nenhuma luz direcional ativa encontrada. Criando...');
        
        const lightEntity = new pc.Entity('Directional Light');
        lightEntity.addComponent('light', {
            type: 'directional',
            color: new pc.Color(1, 1, 1),
            intensity: 1,
            castShadows: true,
            shadowDistance: 40,
            shadowResolution: 2048
        });
        lightEntity.setEulerAngles(45, 45, 0);
        app.root.addChild(lightEntity);
        
        console.log('✅ Luz direcional criada!');
    }
    
    // 2. Ajustar configurações de cena
    console.log('🎨 Ajustando configurações de cena...');
    
    const oldAmbient = scene.ambientLight.clone();
    if (scene.ambientLight.r === 0 && scene.ambientLight.g === 0 && scene.ambientLight.b === 0) {
        scene.ambientLight.set(0.2, 0.2, 0.2);
        console.log('✅ Luz ambiente ajustada de [0,0,0] para [0.2,0.2,0.2]');
    } else {
        console.log(`ℹ️  Luz ambiente atual: [${scene.ambientLight.r}, ${scene.ambientLight.g}, ${scene.ambientLight.b}]`);
    }
    
    if (scene.exposure < 0.5) {
        scene.exposure = 1.0;
        console.log('✅ Exposure ajustado para 1.0');
    } else {
        console.log(`ℹ️  Exposure atual: ${scene.exposure}`);
    }
    
    // 3. Verificar e corrigir materiais
    console.log('🎨 Verificando materiais...');
    
    const renders = app.root.findComponents('render');
    let materialsFixed = 0;
    
    renders.forEach(render => {
        render.meshInstances.forEach(mi => {
            if (mi.material && mi.material instanceof pc.StandardMaterial) {
                let needsUpdate = false;
                
                // Garantir que useLighting está habilitado
                if (mi.material.useLighting === false) {
                    mi.material.useLighting = true;
                    needsUpdate = true;
                }
                
                // Garantir que blendType é BLEND_NONE (opaco)
                if (mi.material.blendType !== pc.BLEND_NONE && mi.material.opacity >= 1.0) {
                    mi.material.blendType = pc.BLEND_NONE;
                    needsUpdate = true;
                }
                
                // Garantir opacity = 1 se não for transparente
                if (mi.material.blendType === pc.BLEND_NONE && mi.material.opacity < 1.0) {
                    mi.material.opacity = 1.0;
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    mi.material.update();
                    materialsFixed++;
                }
            }
        });
    });
    
    if (materialsFixed > 0) {
        console.log(`✅ ${materialsFixed} materiais corrigidos`);
    } else {
        console.log('ℹ️  Nenhum material precisou correção');
    }
    
    // 4. Verificar câmera do editor
    if (typeof editor !== 'undefined') {
        const camera = editor.call('camera:current');
        if (camera && camera.camera) {
            console.log('📷 Configurações da câmera:');
            console.log(`   - Tone Mapping: ${camera.camera.toneMapping} (0=LINEAR, 3=ACES)`);
            console.log(`   - Gamma Correction: ${camera.camera.gammaCorrection} (0=NONE, 1=SRGB)`);
            console.log(`   - Clear Color: [${camera.camera.clearColor.r}, ${camera.camera.clearColor.g}, ${camera.camera.clearColor.b}]`);
        }
    }
    
    // 5. Forçar re-render
    if (typeof editor !== 'undefined') {
        editor.call('viewport:render');
        console.log('✅ Viewport re-renderizado');
    }
    
    console.log('✅ Correção concluída!');
    console.log('');
    console.log('Se ainda houver problemas, execute: diagnoseRendering()');
}

function diagnoseRendering() {
    const app = pc.Application.getApplication();
    const scene = app.scene;
    
    console.log('🔍 DIAGNÓSTICO DE RENDERIZAÇÃO');
    console.log('================================\n');
    
    // Luzes
    console.log('💡 LUZES:');
    const lights = app.root.findComponents('light');
    if (lights.length === 0) {
        console.log('❌ NENHUMA LUZ NA CENA!');
    } else {
        lights.forEach(light => {
            console.log(`   - ${light.entity.name}:`);
            console.log(`     • Tipo: ${light.type}`);
            console.log(`     • Enabled: ${light.enabled}`);
            console.log(`     • Intensity: ${light.intensity}`);
            console.log(`     • Color: [${light.color.r}, ${light.color.g}, ${light.color.b}]`);
            if (light.type === 'directional') {
                console.log(`     • CastShadows: ${light.castShadows}`);
            }
        });
    }
    console.log('');
    
    // Configurações de Cena
    console.log('🎬 CENA:');
    console.log(`   - Ambient Light: [${scene.ambientLight.r}, ${scene.ambientLight.g}, ${scene.ambientLight.b}]`);
    console.log(`   - Exposure: ${scene.exposure}`);
    console.log(`   - Skybox Intensity: ${scene.skyboxIntensity}`);
    console.log(`   - Skybox Mip: ${scene.skyboxMip}`);
    console.log('');
    
    // Câmera
    console.log('📷 CÂMERA:');
    if (typeof editor !== 'undefined') {
        const camera = editor.call('camera:current');
        if (camera && camera.camera) {
            const tmNames = ['LINEAR', 'FILMIC', 'HEJL', 'ACES', 'ACES2', 'NEUTRAL'];
            const gcNames = ['NONE', 'SRGB'];
            console.log(`   - Tone Mapping: ${camera.camera.toneMapping} (${tmNames[camera.camera.toneMapping] || 'UNKNOWN'})`);
            console.log(`   - Gamma Correction: ${camera.camera.gammaCorrection} (${gcNames[camera.camera.gammaCorrection] || 'UNKNOWN'})`);
            console.log(`   - Clear Color: [${camera.camera.clearColor.r.toFixed(2)}, ${camera.camera.clearColor.g.toFixed(2)}, ${camera.camera.clearColor.b.toFixed(2)}, ${camera.camera.clearColor.a.toFixed(2)}]`);
        }
    }
    console.log('');
    
    // Materiais (sample)
    console.log('🎨 MATERIAIS (primeiros 5):');
    const renders = app.root.findComponents('render');
    let sampleCount = 0;
    renders.forEach(render => {
        if (sampleCount >= 5) return;
        
        render.meshInstances.forEach(mi => {
            if (sampleCount >= 5) return;
            
            if (mi.material) {
                const mat = mi.material;
                const blendNames = ['NONE', 'NORMAL', 'ADDITIVE', 'MULT', 'ADDALPHE', 'MULT2X', 'SCREEN', 'MIN', 'MAX'];
                console.log(`   - ${mat.name || 'unnamed'}:`);
                console.log(`     • BlendType: ${mat.blendType} (${blendNames[mat.blendType] || 'UNKNOWN'})`);
                
                if (mat instanceof pc.StandardMaterial) {
                    console.log(`     • useLighting: ${mat.useLighting}`);
                    console.log(`     • useTonemap: ${mat.useTonemap}`);
                    console.log(`     • useSkybox: ${mat.useSkybox}`);
                    console.log(`     • opacity: ${mat.opacity}`);
                    console.log(`     • diffuse: [${mat.diffuse.r.toFixed(2)}, ${mat.diffuse.g.toFixed(2)}, ${mat.diffuse.b.toFixed(2)}]`);
                }
                sampleCount++;
            }
        });
    });
    console.log('');
    
    // Resumo
    console.log('📊 RESUMO:');
    console.log(`   - Total de luzes: ${lights.length}`);
    console.log(`   - Total de render components: ${renders.length}`);
    
    const hasLight = lights.some(l => l.enabled);
    const hasAmbient = scene.ambientLight.r > 0 || scene.ambientLight.g > 0 || scene.ambientLight.b > 0;
    
    if (!hasLight && !hasAmbient) {
        console.log('   ❌ PROBLEMA CRÍTICO: Sem iluminação na cena!');
        console.log('   💡 Execute: fixRendering()');
    } else if (!hasLight) {
        console.log('   ⚠️  Aviso: Apenas luz ambiente (sem luzes direcionais)');
    } else {
        console.log('   ✅ Iluminação básica OK');
    }
}

// Executar diagnóstico inicial
console.log('🔧 Scripts de correção carregados!');
console.log('Digite: fixRendering() para corrigir problemas automaticamente');
console.log('Digite: diagnoseRendering() para diagnóstico detalhado');
