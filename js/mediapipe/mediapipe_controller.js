// Arranca un filtro facial: camara + MediaPipe + escena JSON del editor de three.js.
//
// Uso en una pagina HTML:
//   import { startFaceFilter } from "./js/mediapipe/mediapipe_controller.js";
//   startFaceFilter("face-scene.json");
//
// Como se usa la escena:
//   - El objeto llamado "mesh_0" es la mascara: se deforma con la cara.
//   - Todo lo demas (gafas, accesorios, luces, ...) sigue la posicion, el giro y el
//     tamaño de la cabeza (ver js/mediapipe/face_mask.js para las unidades).
//   - Los scripts de la escena reciben los eventos faciales (ver js/app.js).

import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.20.0/+esm";

import WebCamera from "../webcamera.js";
import ThreePlayer from "../app.js";
import MPFaceTracker from "./mp_face_tracker.js";
import MPFaceRenderer from "./mp_face_renderer.js";
import ThreeFaceRenderer from "./three_face_renderer.js";
import FaceEvents from "./face_events.js";

const MASK_NAME = "mesh_0";

export async function startFaceFilter(scenePath, { showGui = true } = {}) {

    const app = document.getElementById("app");
    const video = document.getElementById("video-renderer");
    const canvas = document.getElementById("canvas-renderer");

    // Camara y seguimiento de la cara
    const webCamera = new WebCamera(video);
    await webCamera.startCamera();

    const tracker = new MPFaceTracker(video);
    await tracker.init();

    const faceEvents = new FaceEvents();

    // Ayudas 2D de MediaPipe (malla, puntos, contornos) sobre el video
    const mpRenderer = new MPFaceRenderer(video, canvas);

    // Escena 3D del editor
    const player = new ThreePlayer(app);
    player.face = faceEvents;
    faceEvents.addListener((type, face) => player.dispatch(type, face));
    await player.loadProject(scenePath);

    const faceRenderer = new ThreeFaceRenderer(video, player);
    faceRenderer.alignCamera();

    // Efecto SLURP: chorrito de slime verde que sale de la boca al abrirla.
    // Se dibuja en SVG sobre la cámara para seguir los landmarks en tiempo real.
    const vomitOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    vomitOverlay.setAttribute("viewBox", `0 0 ${video.videoWidth || 1} ${video.videoHeight || 1}`);
    vomitOverlay.setAttribute("preserveAspectRatio", "none");
    vomitOverlay.setAttribute("aria-hidden", "true");
    Object.assign(vomitOverlay.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        zIndex: "4",
        pointerEvents: "none",
        overflow: "visible",
        display: "block",
        transform: "scaleX(-1)",
        opacity: "0",
        transition: "opacity 90ms ease-out"
    });

    vomitOverlay.innerHTML = `
        <defs>
            <linearGradient id="slurpSlimeGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#d7ff35"/>
                <stop offset="48%" stop-color="#9be000"/>
                <stop offset="100%" stop-color="#48b900"/>
            </linearGradient>
            <filter id="slurpSlimeShadow" x="-30%" y="-20%" width="160%" height="160%">
                <feDropShadow dx="3" dy="5" stdDeviation="2" flood-color="#102000" flood-opacity=".45"/>
            </filter>
        </defs>
        <g id="slurp-vomit-shape" opacity="0">
            <path id="slurp-vomit-main"
                d="M .08 0 C .18 .16 .18 .28 .30 .43 C .38 .55 .25 .72 .38 .91
                   C .45 1.02 .58 .98 .62 .84 C .67 .69 .57 .58 .72 .43
                   C .84 .29 .78 .16 .92 0 Z"
                fill="url(#slurpSlimeGradient)" stroke="#101600" stroke-width=".045"
                stroke-linejoin="round"/>
            <path d="M .24 .18 C .34 .29 .31 .38 .40 .47"
                fill="none" stroke="#efff9b" stroke-width=".055" stroke-linecap="round" opacity=".9"/>
            <path d="M .70 .16 C .78 .25 .70 .31 .76 .36"
                fill="none" stroke="#efff9b" stroke-width=".035" stroke-linecap="round" opacity=".8"/>
            <circle cx=".16" cy=".55" r=".055" fill="#caff38" stroke="#101600" stroke-width=".025"/>
            <circle cx=".84" cy=".69" r=".035" fill="#caff38" stroke="#101600" stroke-width=".02"/>
            <path d="M .43 .99 C .39 1.13 .47 1.19 .51 1.08 C .56 1.19 .64 1.13 .59 .98"
                fill="#79d000" stroke="#101600" stroke-width=".035" stroke-linejoin="round"/>
        </g>
    `;
    app.appendChild(vomitOverlay);

    const vomitShape = vomitOverlay.querySelector("#slurp-vomit-shape");

    // Espiral SLURP: aparece sobre el ojo que se cierre y gira continuamente.
    // Cada ojo tiene su propia espiral y su propia capa de rotación.
    const spiralStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    spiralStyle.textContent = "@keyframes slurp-eye-spin { to { transform: rotate(360deg); } }";

    const spiralOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    spiralOverlay.setAttribute("viewBox", `0 0 ${video.videoWidth || 1} ${video.videoHeight || 1}`);
    spiralOverlay.setAttribute("preserveAspectRatio", "xMidYMid slice");
    spiralOverlay.setAttribute("aria-hidden", "true");
    Object.assign(spiralOverlay.style, {
        position: "absolute", inset: "0", width: "100%", height: "100%",
        zIndex: "5", pointerEvents: "none", overflow: "visible",
        transform: "scaleX(-1)"
    });
    spiralOverlay.appendChild(spiralStyle);

    function createEyeSpiral(id) {
        const position = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const rotating = document.createElementNS("http://www.w3.org/2000/svg", "g");
        rotating.setAttribute("id", id);
        rotating.setAttribute("opacity", "0");
        rotating.innerHTML = `
        <defs>
            <linearGradient id="slurpSpiralPink" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ff8bc9"/>
                <stop offset="38%" stop-color="#ff3ca4"/>
                <stop offset="100%" stop-color="#e60078"/>
            </linearGradient>
        </defs>
        <path d="M 52 7 C 79 5 97 27 91 54 C 86 82 60 96 34 84
                 C 10 73 8 45 25 25 C 42 6 72 13 79 37
                 C 86 60 69 79 48 76 C 29 73 22 55 31 40
                 C 40 25 61 28 66 42 C 71 55 61 65 49 63
                 C 40 62 37 54 42 48"
              fill="none" stroke="#171019" stroke-width="31"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 52 7 C 79 5 97 27 91 54 C 86 82 60 96 34 84
                 C 10 73 8 45 25 25 C 42 6 72 13 79 37
                 C 86 60 69 79 48 76 C 29 73 22 55 31 40
                 C 40 25 61 28 66 42 C 71 55 61 65 49 63
                 C 40 62 37 54 42 48"
              fill="none" stroke="url(#slurpSpiralPink)" stroke-width="23"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 35 15 C 52 5 72 12 78 27"
              fill="none" stroke="#ffd0e8" stroke-width="4"
              stroke-linecap="round" opacity=".9"/>
        <path d="M 17 49 C 14 64 24 77 37 81"
              fill="none" stroke="#ffb4dc" stroke-width="3.5"
              stroke-linecap="round" opacity=".8"/>
        <path d="M 71 72 C 82 64 87 51 83 39"
              fill="none" stroke="#b90062" stroke-width="3"
              stroke-linecap="round" opacity=".7"/>
        <ellipse cx="72" cy="20" rx="5" ry="2.5" fill="#ffe0ef" transform="rotate(24 72 20)"/>
        <circle cx="22" cy="35" r="2.5" fill="#ffd0e8"/>
        <circle cx="85" cy="72" r="2" fill="#ffd0e8"/>
`;
        Object.assign(rotating.style, {
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "slurp-eye-spin 1.05s linear infinite"
        });
        position.appendChild(rotating);
        spiralOverlay.appendChild(position);
        return { position, rotating };
    }

    const leftEyeSpiral = createEyeSpiral("slurp-left-eye-spiral");
    const rightEyeSpiral = createEyeSpiral("slurp-right-eye-spiral");
    app.appendChild(spiralOverlay);

    // Sonido UFO: se reproduce una sola vez cada vez que empieza una sonrisa.
    const ufoSound = new Audio(new URL("../../assets/ufo.mp3", import.meta.url).href);
    ufoSound.preload = "auto";
    ufoSound.volume = 0.8;
    let wasSmiling = false;

    function updateSlurpSpiral(landmarks) {
        spiralOverlay.setAttribute("viewBox", `0 0 ${video.videoWidth || 1} ${video.videoHeight || 1}`);
        const smileLeft = tracker.getBlendShape("mouthSmileLeft");
        const smileRight = tracker.getBlendShape("mouthSmileRight");
        const smile = Math.max(smileLeft, smileRight);
        const visible = !!landmarks && smile >= 0.22;

        // Dispara el audio al comenzar la sonrisa, no en cada fotograma.
        if (visible && !wasSmiling) {
            ufoSound.currentTime = 0;
            ufoSound.play().catch((error) => {
                console.warn("No se pudo reproducir el sonido UFO:", error);
            });
        } else if (!visible && wasSmiling) {
            // Detiene el sonido inmediatamente cuando deja de sonreír.
            ufoSound.pause();
            ufoSound.currentTime = 0;
        }
        wasSmiling = visible;

        const placeSpiral = (spiral, outerIndex, innerIndex) => {
            if (!visible) {
                spiral.rotating.setAttribute("opacity", "0");
                return;
            }
            const outer = landmarks[outerIndex];
            const inner = landmarks[innerIndex];
            if (!outer || !inner) {
                spiral.rotating.setAttribute("opacity", "0");
                return;
            }
            const centerX = (outer.x + inner.x) * 0.5 * video.videoWidth;
            const centerY = (outer.y + inner.y) * 0.5 * video.videoHeight;
            const eyeWidth = Math.hypot(
                (inner.x - outer.x) * video.videoWidth,
                (inner.y - outer.y) * video.videoHeight
            );
            const size = Math.max(eyeWidth * 1.55, 42);
            spiral.position.setAttribute(
                "transform",
                `translate(${centerX - size / 2} ${centerY - size / 2}) scale(${size / 100})`
            );
            spiral.rotating.setAttribute("opacity", String(Math.min(1, 0.7 + smile * 0.4)));
        };

        // MediaPipe: ojo anatómico izquierdo (362-263) y derecho (33-133).
        placeSpiral(leftEyeSpiral, 362, 263);
        placeSpiral(rightEyeSpiral, 33, 133);
    }

    function updateSlurpVomit(landmarks) {
        const jawOpen = tracker.getMouthOpen();
        const upperLip = landmarks?.[13];
        const lowerLip = landmarks?.[14];
        const leftCorner = landmarks?.[61];
        const rightCorner = landmarks?.[291];

        if (
            !landmarks || !upperLip || !lowerLip ||
            !leftCorner || !rightCorner ||
            !video.videoWidth || !video.videoHeight
        ) {
            vomitOverlay.style.opacity = "0";
            vomitShape.setAttribute("opacity", "0");
            return;
        }

        // El SVG usa el tamaño visible del contenedor, no la resolución
        // interna de la cámara. Así coincide con object-fit: cover también
        // cuando el móvil entrega video horizontal en una pantalla vertical.
        const overlayWidth = app.clientWidth || video.videoWidth;
        const overlayHeight = app.clientHeight || video.videoHeight;
        const videoScale = Math.max(
            overlayWidth / video.videoWidth,
            overlayHeight / video.videoHeight
        );

        // Mantiene el sistema de coordenadas del SVG igual al tamaño visible
        // del contenedor. No debe volver a la resolución interna del video.
        const currentViewBox = vomitOverlay.getAttribute("viewBox");
        const expectedViewBox = `0 0 ${overlayWidth} ${overlayHeight}`;
        if (currentViewBox !== expectedViewBox) {
            vomitOverlay.setAttribute("viewBox", expectedViewBox);
        }
        const renderedWidth = video.videoWidth * videoScale;
        const renderedHeight = video.videoHeight * videoScale;
        const cropX = (overlayWidth - renderedWidth) / 2;
        const cropY = (overlayHeight - renderedHeight) / 2;

        const width = Math.hypot(
            (rightCorner.x - leftCorner.x) * video.videoWidth,
            (rightCorner.y - leftCorner.y) * video.videoHeight
        );
        const mouthGap = Math.hypot(
            (lowerLip.x - upperLip.x) * video.videoWidth,
            (lowerLip.y - upperLip.y) * video.videoHeight
        );

        // Se conserva el mismo detector que ya activa el sonido Splash.
        const mouthOpeningRatio = mouthGap / Math.max(width, 1);
        const isMouthOpen = jawOpen >= 0.18 || mouthOpeningRatio >= 0.065;

        if (!isMouthOpen) {
            vomitOverlay.style.opacity = "0";
            vomitShape.setAttribute("opacity", "0");
            return;
        }

        const centerX = ((leftCorner.x + rightCorner.x) * 0.5 * video.videoWidth) * videoScale + cropX;
        const mouthBottomY = Math.max(upperLip.y, lowerLip.y) * video.videoHeight * videoScale + cropY;

        // Escala el slime en coordenadas visibles para mantener su posición
        // y tamaño correctos en móviles y escritorio.
        const effectWidth = Math.max(width * videoScale * 0.92, 18);
        const effectHeight = Math.max(mouthGap * videoScale * 2.8, width * videoScale * 0.72);
        const startY = mouthBottomY - effectHeight * 0.08;

        vomitShape.setAttribute(
            "transform",
            `translate(${centerX - effectWidth / 2} ${startY}) scale(${effectWidth} ${effectHeight})`
        );
        vomitShape.setAttribute("opacity", String(Math.min(1, 0.72 + jawOpen * 0.5)));
        vomitOverlay.style.opacity = "1";
    }


    // La mascara sale del grupo de la escena: se coloca vertice a vertice en la cara.
    // Sus hijos (si alguien los emparento en el editor) se quedan en la escena
    // para que sigan la cabeza como el resto de objetos.
    const mask = player.rootNode.getObjectByName(MASK_NAME);
    if (mask) {
        for (const child of [...mask.children]) mask.parent.attach(child);
        mask.frustumCulled = false;
        faceRenderer.faceGroup.add(mask);
    } else {
        console.warn(`La escena no tiene un objeto "${MASK_NAME}": no habra mascara facial.`);
    }

    const settings = { headScale: 1 };

    function update() {

        tracker.update();
        faceEvents.update(tracker);

        const landmarks = tracker.getLandmarks();
        faceRenderer.setLandmarks(landmarks);
        updateSlurpVomit(landmarks);
        updateSlurpSpiral(landmarks);

        mpRenderer.drawMesh(landmarks);
        mpRenderer.drawPoints(landmarks);
        mpRenderer.drawIrises(landmarks);
        mpRenderer.drawContours(landmarks);

        faceRenderer.drawMesh(landmarks);
        faceRenderer.drawConnectors(landmarks);
        faceRenderer.drawContours(landmarks);
        faceRenderer.drawIrises(landmarks);
        faceRenderer.drawPoints(landmarks);
        if (mask) faceRenderer.syncFaceMesh(mask);

        // La escena sigue la cabeza (solo se oculta la mascara si no hay cara).
        const detected = tracker.getFaceCount() > 0;
        player.rootNode.visible = detected;
        if (mask) mask.visible = detected;

        const pose = detected ? faceRenderer.getHeadPose() : null;
        if (pose) {
            player.rootNode.position.copy(pose.position);
            player.rootNode.quaternion.copy(pose.quaternion);
            player.rootNode.scale.setScalar(pose.scale * settings.headScale);
        }

        player.update();
        requestAnimationFrame(update);

    }

    window.addEventListener("resize", () => {
        mpRenderer.resize();
        player.resize();
        faceRenderer.alignCamera();
    });

    if (showGui) createGui(settings, mpRenderer, faceRenderer);

    update();

    // Para depurar desde la consola del navegador.
    const filter = { webCamera, tracker, faceEvents, mpRenderer, player, faceRenderer, mask };
    window.faceFilter = filter;
    return filter;

}

function createGui(settings, mpRenderer, faceRenderer) {

    const gui = new GUI({ title: "Controles" });
    gui.close();

    const helpers2D = gui.addFolder("Ayudas 2D (MediaPipe)");
    helpers2D.add(mpRenderer, "showHelpers").name("Mostrar");
    helpers2D.add(mpRenderer, "showMesh").name("Malla");
    helpers2D.add(mpRenderer, "showPoints").name("Puntos");
    helpers2D.add(mpRenderer, "showContours").name("Contornos");
    helpers2D.add(mpRenderer, "showIrises").name("Iris");

    const helpers3D = gui.addFolder("Ayudas 3D (three.js)");
    helpers3D.add(faceRenderer, "showHelpers").name("Mostrar");
    helpers3D.add(faceRenderer, "showMesh").name("Malla");
    helpers3D.add(faceRenderer, "showConnectors").name("Conexiones");
    helpers3D.add(faceRenderer, "showPoints").name("Puntos");
    helpers3D.add(faceRenderer, "showContours").name("Contornos");
    helpers3D.add(faceRenderer, "showIrises").name("Iris");

    const scene = gui.addFolder("Escena");
    scene.add(settings, "headScale", 0.1, 5).name("Escala de la cabeza");
    scene.add(faceRenderer, "exportAndDownloadMesh").name("Exportar malla capturada (.glb)");

}
