// @config DESCRIPTION Spatial hub MVP: walk in a 3D lobby, target portals and click / press E to open games or tools.
import { data } from 'examples/observer';
import { deviceType } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
canvas.setAttribute('tabindex', '0');
canvas.style.outline = 'none';
window.focus();

data.set('hub', {
    walkSpeed: 6,
    sprintMultiplier: 1.75,
    lookSensitivity: 0.16,
    videoEnabled: true,
    videoVolume: 0,
    floatingScreenScale: 1,
    floatingScreenDistance: 7
});

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.scene.ambientLight = new pc.Color(0.35, 0.35, 0.38);

const createStandardMaterial = (diffuse, emissive = null, emissiveIntensity = 1) => {
    const material = new pc.StandardMaterial();
    material.diffuse = diffuse;
    if (emissive) {
        material.emissive = emissive;
        material.emissiveIntensity = emissiveIntensity;
    }
    material.update();
    return material;
};

const roomMaterial = createStandardMaterial(new pc.Color(0.1, 0.1, 0.12));
const floorMaterial = createStandardMaterial(new pc.Color(0.25, 0.25, 0.28));

const createBox = (name, position, scale, material) => {
    const entity = new pc.Entity(name);
    entity.addComponent('render', {
        type: 'box',
        material
    });
    entity.setPosition(position);
    entity.setLocalScale(scale);
    app.root.addChild(entity);
    return entity;
};

const roomHalfSize = new pc.Vec3(15, 6, 12);

createBox('floor', new pc.Vec3(0, -0.1, 0), new pc.Vec3(roomHalfSize.x * 2, 0.2, roomHalfSize.z * 2), floorMaterial);
createBox('ceiling', new pc.Vec3(0, roomHalfSize.y, 0), new pc.Vec3(roomHalfSize.x * 2, 0.25, roomHalfSize.z * 2), roomMaterial);
createBox('wall-back', new pc.Vec3(0, roomHalfSize.y * 0.5, -roomHalfSize.z), new pc.Vec3(roomHalfSize.x * 2, roomHalfSize.y, 0.25), roomMaterial);
createBox('wall-front', new pc.Vec3(0, roomHalfSize.y * 0.5, roomHalfSize.z), new pc.Vec3(roomHalfSize.x * 2, roomHalfSize.y, 0.25), roomMaterial);
createBox('wall-left', new pc.Vec3(-roomHalfSize.x, roomHalfSize.y * 0.5, 0), new pc.Vec3(0.25, roomHalfSize.y, roomHalfSize.z * 2), roomMaterial);
createBox('wall-right', new pc.Vec3(roomHalfSize.x, roomHalfSize.y * 0.5, 0), new pc.Vec3(0.25, roomHalfSize.y, roomHalfSize.z * 2), roomMaterial);

const keyLight = new pc.Entity('key-light');
keyLight.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 1, 1),
    intensity: 1.3,
    castShadows: false
});
keyLight.setEulerAngles(45, 35, 0);
app.root.addChild(keyLight);

const fillLight = new pc.Entity('fill-light');
fillLight.addComponent('light', {
    type: 'omni',
    color: new pc.Color(0.6, 0.68, 1),
    intensity: 1.6,
    range: 20
});
fillLight.setPosition(0, 4.5, 0);
app.root.addChild(fillLight);

const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.04, 0.05, 0.08),
    farClip: 500
});
camera.setPosition(0, 1.65, 7);
app.root.addChild(camera);

const portalFrameMaterial = createStandardMaterial(new pc.Color(0.16, 0.2, 0.26), new pc.Color(0.25, 0.35, 0.8), 0.6);

const portals = [];
const portalEntries = [
    {
        name: 'Pixlland Editor',
        url: 'http://localhost:3487',
        color: new pc.Color(0.25, 0.65, 1),
        position: new pc.Vec3(-10, 2.4, -11.85)
    },
    {
        name: 'Engine Examples',
        url: 'http://localhost:5555/#/',
        color: new pc.Color(0.2, 0.9, 0.55),
        position: new pc.Vec3(-4.2, 2.4, -11.85)
    },
    {
        name: 'Blend Trees 2D',
        url: 'http://localhost:5555/#/animation/blend-trees-2d-cartesian',
        color: new pc.Color(1, 0.65, 0.2),
        position: new pc.Vec3(1.8, 2.4, -11.85)
    },
    {
        name: 'User Game Portal',
        url: 'https://playcanvas.com',
        color: new pc.Color(1, 0.35, 0.45),
        position: new pc.Vec3(7.8, 2.4, -11.85)
    }
];

const createPortal = (entry) => {
    const root = new pc.Entity(`portal-${entry.name.toLowerCase().replace(/\s+/g, '-')}`);
    root.setPosition(entry.position);
    app.root.addChild(root);

    const frame = new pc.Entity('frame');
    frame.addComponent('render', {
        type: 'box',
        material: portalFrameMaterial
    });
    frame.setLocalScale(4.6, 2.8, 0.18);
    root.addChild(frame);

    const screenMat = createStandardMaterial(new pc.Color(0.12, 0.12, 0.14), entry.color, 1.8);
    screenMat.useLighting = false;
    screenMat.update();

    const screen = new pc.Entity('screen');
    screen.addComponent('render', {
        type: 'box',
        material: screenMat
    });
    screen.setLocalScale(4.2, 2.4, 0.08);
    screen.setLocalPosition(0, 0, 0.08);
    root.addChild(screen);

    portals.push({
        name: entry.name,
        url: entry.url,
        material: screenMat,
        defaultEmissive: entry.color.clone(),
        entity: screen
    });
};

portalEntries.forEach(createPortal);

const videoWallMaterial = new pc.StandardMaterial();
videoWallMaterial.useLighting = false;
videoWallMaterial.emissive = new pc.Color(1, 1, 1);
videoWallMaterial.emissiveIntensity = 1.2;

const videoWall = new pc.Entity('video-wall');
videoWall.addComponent('render', {
    type: 'box',
    material: videoWallMaterial
});
videoWall.setLocalScale(9, 4.8, 0.12);
videoWall.setPosition(0, 3.05, 11.8);
app.root.addChild(videoWall);

const videoWallDefaultPosition = videoWall.getPosition().clone();
const videoWallDefaultEuler = videoWall.getEulerAngles().clone();
const videoWallBaseScale = new pc.Vec3(9, 4.8, 0.12);

let floatingScreenGrabbed = false;
let floatingScreenDistance = Number(data.get('hub.floatingScreenDistance')) || 7;
let floatingScreenScale = Number(data.get('hub.floatingScreenScale')) || 1;
const floatingScreenDistanceRange = { min: 2.5, max: 18 };
const floatingScreenScaleRange = { min: 0.45, max: 2.3 };

const video = document.createElement('video');
video.src = 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4';
video.crossOrigin = 'anonymous';
video.loop = true;
video.muted = true;
video.playsInline = true;

const videoTexture = new pc.Texture(device, {
    width: 2,
    height: 2,
    format: pc.PIXELFORMAT_SRGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE
});

videoWallMaterial.diffuseMap = videoTexture;
videoWallMaterial.emissiveMap = videoTexture;
videoWallMaterial.update();

video.play().catch(() => {
    // Browser can block autoplay until user gesture; click to lock pointer will try again.
});

const hud = document.createElement('div');
hud.style.position = 'absolute';
hud.style.left = '50%';
hud.style.bottom = '22px';
hud.style.transform = 'translateX(-50%)';
hud.style.padding = '10px 14px';
hud.style.borderRadius = '10px';
hud.style.color = '#d7e3ff';
hud.style.background = 'rgba(8, 12, 22, 0.75)';
hud.style.fontFamily = 'system-ui, -apple-system, sans-serif';
hud.style.fontSize = '13px';
hud.style.letterSpacing = '0.2px';
hud.style.pointerEvents = 'none';
hud.textContent = 'Click para capturar mouse • WASD mover • E abre portal • F pega tela • +/- tamanho';

const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.left = '50%';
crosshair.style.top = '50%';
crosshair.style.width = '8px';
crosshair.style.height = '8px';
crosshair.style.marginLeft = '-4px';
crosshair.style.marginTop = '-4px';
crosshair.style.borderRadius = '999px';
crosshair.style.background = '#9dc1ff';
crosshair.style.boxShadow = '0 0 0 2px rgba(12,18,30,0.5)';
crosshair.style.pointerEvents = 'none';

document.body.appendChild(hud);
document.body.appendChild(crosshair);

app.on('destroy', () => {
    hud.remove();
    crosshair.remove();
    video.pause();
    videoTexture.destroy();
});

const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    ShiftLeft: false,
    ShiftRight: false
};

let yaw = 180;
let pitch = -5;
let dragLookActive = false;
let lastDragX = 0;
let lastDragY = 0;
const velocity = new pc.Vec3();
const forward = new pc.Vec3();
const right = new pc.Vec3();
const moveDir = new pc.Vec3();
const ray = new pc.Ray();
const rayStart = new pc.Vec3();
const rayEnd = new pc.Vec3();
const rayDir = new pc.Vec3();
const hitPoint = new pc.Vec3();
const hitPointScreen = new pc.Vec3();
const cameraForward3D = new pc.Vec3();
const floatingScreenTarget = new pc.Vec3();
const floatingScreenOffset = new pc.Vec3(0, -0.35, 0);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const focusHubInput = () => {
    canvas.focus();
    window.focus();
};

const clearKeys = () => {
    Object.keys(keys).forEach((key) => {
        keys[key] = false;
    });
};

const setLookFromMouse = (event) => {
    if (document.pointerLockElement !== canvas) {
        if (!dragLookActive) {
            return;
        }

        const sensitivity = Number(data.get('hub.lookSensitivity')) || 0.16;
        const deltaX = event.clientX - lastDragX;
        const deltaY = event.clientY - lastDragY;
        lastDragX = event.clientX;
        lastDragY = event.clientY;
        yaw -= deltaX * sensitivity;
        pitch = clamp(pitch - deltaY * sensitivity, -85, 85);
        camera.setEulerAngles(pitch, yaw, 0);
        return;
    }
    const sensitivity = Number(data.get('hub.lookSensitivity')) || 0.16;
    yaw -= event.movementX * sensitivity;
    pitch = clamp(pitch - event.movementY * sensitivity, -85, 85);
    camera.setEulerAngles(pitch, yaw, 0);
};

const setMovementKey = (event, pressed) => {
    if (event.code in keys) {
        keys[event.code] = pressed;
    }

    switch (event.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
            keys.KeyW = pressed;
            break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
            keys.KeyA = pressed;
            break;
        case 's':
        case 'S':
        case 'ArrowDown':
            keys.KeyS = pressed;
            break;
        case 'd':
        case 'D':
        case 'ArrowRight':
            keys.KeyD = pressed;
            break;
    }
};

const getCenterTarget = () => {
    const x = canvas.clientWidth * 0.5;
    const y = canvas.clientHeight * 0.5;

    camera.camera.screenToWorld(x, y, camera.camera.nearClip, rayStart);
    camera.camera.screenToWorld(x, y, camera.camera.farClip, rayEnd);
    rayDir.sub2(rayEnd, rayStart).normalize();
    ray.set(rayStart, rayDir);

    let selectedPortal = null;
    let selectedPortalDist = Infinity;
    for (let i = 0; i < portals.length; i++) {
        const portal = portals[i];
        const meshInstance = portal.entity.render?.meshInstances?.[0];
        if (!meshInstance) {
            continue;
        }
        if (!meshInstance.aabb.intersectsRay(ray, hitPoint)) {
            continue;
        }
        const dist = rayStart.distance(hitPoint);
        if (dist < selectedPortalDist && dist < 40) {
            selectedPortalDist = dist;
            selectedPortal = portal;
        }
    }

    let selectedScreen = false;
    let selectedScreenDist = Infinity;
    const screenMeshInstance = videoWall.render?.meshInstances?.[0];
    if (screenMeshInstance && screenMeshInstance.aabb.intersectsRay(ray, hitPointScreen)) {
        selectedScreenDist = rayStart.distance(hitPointScreen);
        selectedScreen = selectedScreenDist < 50;
    }

    if (selectedScreen && selectedPortal && selectedScreenDist <= selectedPortalDist) {
        return { type: 'screen', portal: null };
    }
    if (selectedPortal) {
        return { type: 'portal', portal: selectedPortal };
    }
    if (selectedScreen) {
        return { type: 'screen', portal: null };
    }
    return { type: 'none', portal: null };
};

const triggerPortal = (portal) => {
    if (!portal) {
        return;
    }
    window.open(portal.url, '_blank', 'noopener');
};

const applyFloatingScreenTransform = () => {
    videoWall.setLocalScale(
        videoWallBaseScale.x * floatingScreenScale,
        videoWallBaseScale.y * floatingScreenScale,
        videoWallBaseScale.z
    );

    if (floatingScreenGrabbed) {
        camera.forward.clone(cameraForward3D).normalize();
        floatingScreenTarget
        .copy(camera.getPosition())
        .add(cameraForward3D.mulScalar(floatingScreenDistance))
        .add(floatingScreenOffset);

        videoWall.setPosition(floatingScreenTarget);
        videoWall.lookAt(camera.getPosition());
        videoWall.rotateLocal(0, 180, 0);
    }
};

const resetFloatingScreen = () => {
    floatingScreenGrabbed = false;
    floatingScreenDistance = 7;
    floatingScreenScale = 1;
    data.set('hub.floatingScreenDistance', floatingScreenDistance);
    data.set('hub.floatingScreenScale', floatingScreenScale);
    videoWall.setPosition(videoWallDefaultPosition);
    videoWall.setEulerAngles(videoWallDefaultEuler);
    applyFloatingScreenTransform();
};

const onClick = () => {
    focusHubInput();
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        video.play().catch(() => {});
        return;
    }

    const target = getCenterTarget();
    if (target.type === 'portal' && target.portal) {
        triggerPortal(target.portal);
        return;
    }
    if (target.type === 'screen') {
        floatingScreenGrabbed = !floatingScreenGrabbed;
    }
};

const onKeyDown = (event) => {
    setMovementKey(event, true);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
    }

    if (event.code === 'KeyE') {
        const target = getCenterTarget();
        if (target.type === 'portal' && target.portal) {
            triggerPortal(target.portal);
        }
    }
    if (event.code === 'KeyF') {
        const target = getCenterTarget();
        if (target.type === 'screen' || floatingScreenGrabbed) {
            floatingScreenGrabbed = !floatingScreenGrabbed;
        }
    }
    if (event.code === 'Minus' || event.code === 'NumpadSubtract' || event.code === 'BracketLeft') {
        floatingScreenScale = clamp(floatingScreenScale - 0.05, floatingScreenScaleRange.min, floatingScreenScaleRange.max);
        data.set('hub.floatingScreenScale', floatingScreenScale);
    }
    if (event.code === 'Equal' || event.code === 'NumpadAdd' || event.code === 'BracketRight') {
        floatingScreenScale = clamp(floatingScreenScale + 0.05, floatingScreenScaleRange.min, floatingScreenScaleRange.max);
        data.set('hub.floatingScreenScale', floatingScreenScale);
    }
    if (event.code === 'KeyR') {
        resetFloatingScreen();
    }
};

const onKeyUp = (event) => {
    setMovementKey(event, false);
};

const onWheel = (event) => {
    if (!floatingScreenGrabbed) {
        return;
    }
    event.preventDefault();
    floatingScreenDistance = clamp(
        floatingScreenDistance + event.deltaY * 0.01,
        floatingScreenDistanceRange.min,
        floatingScreenDistanceRange.max
    );
    data.set('hub.floatingScreenDistance', floatingScreenDistance);
};

const onPointerDown = (event) => {
    focusHubInput();
    if (document.pointerLockElement === canvas) {
        return;
    }
    dragLookActive = true;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
};

const onPointerUp = () => {
    dragLookActive = false;
};

const onPointerLockChange = () => {
    if (document.pointerLockElement !== canvas) {
        dragLookActive = false;
    }
};

const onVisibilityChange = () => {
    if (document.hidden) {
        clearKeys();
    }
};

canvas.addEventListener('click', onClick);
canvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mouseup', onPointerUp);
document.addEventListener('mousemove', setLookFromMouse);
canvas.addEventListener('keydown', onKeyDown);
canvas.addEventListener('keyup', onKeyUp);
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
canvas.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('blur', clearKeys);
document.addEventListener('visibilitychange', onVisibilityChange);
document.addEventListener('pointerlockchange', onPointerLockChange);

app.on('destroy', () => {
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('mousedown', onPointerDown);
    window.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('mousemove', setLookFromMouse);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('blur', clearKeys);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
});

app.on('update', (dt) => {
    const walkSpeed = Number(data.get('hub.walkSpeed')) || 6;
    const sprintMultiplier = Number(data.get('hub.sprintMultiplier')) || 1.75;
    const speed = walkSpeed * (keys.ShiftLeft || keys.ShiftRight ? sprintMultiplier : 1);

    camera.forward.clone(forward);
    camera.right.clone(right);
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    moveDir.set(0, 0, 0);
    if (keys.KeyW) moveDir.add(forward);
    if (keys.KeyS) moveDir.sub(forward);
    if (keys.KeyD) moveDir.add(right);
    if (keys.KeyA) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) {
        moveDir.normalize().mulScalar(speed * dt);
        velocity.lerp(velocity, moveDir, 0.5);
    } else {
        velocity.lerp(velocity, pc.Vec3.ZERO, 0.2);
    }

    camera.translate(velocity);
    const p = camera.getPosition();
    p.x = clamp(p.x, -roomHalfSize.x + 1, roomHalfSize.x - 1);
    p.z = clamp(p.z, -roomHalfSize.z + 1, roomHalfSize.z - 1);
    p.y = 1.65;
    camera.setPosition(p);

    floatingScreenScale = clamp(Number(data.get('hub.floatingScreenScale')) || floatingScreenScale, floatingScreenScaleRange.min, floatingScreenScaleRange.max);
    floatingScreenDistance = clamp(Number(data.get('hub.floatingScreenDistance')) || floatingScreenDistance, floatingScreenDistanceRange.min, floatingScreenDistanceRange.max);
    applyFloatingScreenTransform();

    const centerTarget = getCenterTarget();
    const selectedPortal = centerTarget.type === 'portal' ? centerTarget.portal : null;

    for (let i = 0; i < portals.length; i++) {
        const portal = portals[i];
        if (portal === selectedPortal) {
            portal.material.emissive.copy(portal.defaultEmissive).mulScalar(1.8);
            portal.material.emissiveIntensity = 2.2;
        } else {
            portal.material.emissive.copy(portal.defaultEmissive);
            portal.material.emissiveIntensity = 1.8;
        }
        portal.material.update();
    }

    if (selectedPortal) {
        hud.textContent = `Portal selecionado: ${selectedPortal.name} • E / Click para abrir`;
        crosshair.style.background = '#6effb7';
    } else if (centerTarget.type === 'screen') {
        hud.textContent = floatingScreenGrabbed
            ? 'Tela flutuante ativa • Scroll distância • +/- tamanho • F solta • R reseta'
            : 'Tela selecionada • F ou Click para pegar • +/- tamanho • R reseta';
        crosshair.style.background = '#ffd26e';
    } else if (floatingScreenGrabbed) {
        hud.textContent = 'Tela flutuante ativa • Scroll distância • +/- tamanho • F solta • R reseta';
        crosshair.style.background = '#ffd26e';
    } else {
        hud.textContent = 'Click para capturar mouse • WASD mover • E abre portal • F pega tela • +/- tamanho';
        crosshair.style.background = '#9dc1ff';
    }

    const enableVideo = !!data.get('hub.videoEnabled');
    video.muted = (Number(data.get('hub.videoVolume')) || 0) <= 0;
    video.volume = pc.math.clamp(Number(data.get('hub.videoVolume')) || 0, 0, 1);

    if (enableVideo && video.paused && document.pointerLockElement === canvas) {
        video.play().catch(() => {});
    }
    if (!enableVideo && !video.paused) {
        video.pause();
    }
    if (enableVideo && video.readyState >= video.HAVE_CURRENT_DATA) {
        videoTexture.setSource(video);
    }
});

export { app };