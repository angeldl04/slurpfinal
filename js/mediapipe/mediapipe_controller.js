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
    vomitOverlay.setAttribute("preserveAspectRatio", "xMidYMid slice");
    vomitOverlay.setAttribute("aria-hidden", "true");
    Object.assign(vomitOverlay.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        zIndex: "4",
        pointerEvents: "none",
        overflow: "visible",
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
        <g id="slurp-vomit-shape" opacity="0" filter="url(#slurpSlimeShadow)">
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
    const spiralGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    spiralGroup.setAttribute("id", "slurp-eye-spiral");
    spiralGroup.setAttribute("opacity", "0");
    spiralGroup.innerHTML = `
        <path d="M 50 8 C 78 5 96 27 91 53 C 87 78 62 94 38 85
                 C 15 77 9 51 22 33 C 34 17 59 18 70 33
                 C 81 48 72 67 57 71 C 43 75 31 64 35 51
                 C 38 41 51 38 58 45 C 64 51 60 60 53 61"
              fill="none" stroke="#101600" stroke-width="13"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 50 8 C 78 5 96 27 91 53 C 87 78 62 94 38 85
                 C 15 77 9 51 22 33 C 34 17 59 18 70 33
                 C 81 48 72 67 57 71 C 43 75 31 64 35 51
                 C 38 41 51 38 58 45 C 64 51 60 60 53 61"
              fill="none" stroke="#aaff00" stroke-width="8"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 18 12 L 22 2 L 27 12 L 37 16 L 27 20 L 22 30 L 18 20 L 8 16 Z"
              fill="#d7ff35" stroke="#101600" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="88" cy="12" r="5" fill="#d7ff35" stroke="#101600" stroke-width="2"/>
    `;
    Object.assign(spiralGroup.style, {
        transformBox: "fill-box",
        transformOrigin: "center",
        animation: "slurp-eye-spin 1.05s linear infinite"
    });
    const spiralStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    spiralStyle.textContent = "@keyframes slurp-eye-spin { to { transform: rotate(360deg); } }";
    vomitOverlay.appendChild(spiralStyle);
    vomitOverlay.appendChild(spiralGroup);

    function updateSlurpSpiral(landmarks) {
        const blinkLeft = tracker.getBlendShape("eyeBlinkLeft");
        const blinkRight = tracker.getBlendShape("eyeBlinkRight");
        const leftClosed = blinkLeft > 0.58 && blinkRight < 0.38;
        const rightClosed = blinkRight > 0.58 && blinkLeft < 0.38;

        if (!landmarks || (!leftClosed && !rightClosed)) {
            spiralGroup.setAttribute("opacity", "0");
            return;
        }

        // Centros aproximados de cada ojo a partir de sus esquinas.
        const outer = leftClosed ? landmarks[362] : landmarks[33];
        const inner = leftClosed ? landmarks[263] : landmarks[133];
        if (!outer || !inner) {
            spiralGroup.setAttribute("opacity", "0");
            return;
        }

        const centerX = (outer.x + inner.x) * 0.5 * video.videoWidth;
        const centerY = (outer.y + inner.y) * 0.5 * video.videoHeight;
        const eyeWidth = Math.hypot(
            (inner.x - outer.x) * video.videoWidth,
            (inner.y - outer.y) * video.videoHeight
        );
        const size = Math.max(eyeWidth * 1.55, 42);

        spiralGroup.setAttribute(
            "transform",
            `translate(${centerX - size / 2} ${centerY - size / 2}) scale(${size / 100})`
        );
        spiralGroup.setAttribute("opacity", "1");
    }

    function updateSlurpVomit(landmarks) {
        const jawOpen = tracker.getMouthOpen();
        const upperLip = landmarks?.[13];
        const lowerLip = landmarks?.[14];
        const leftCorner = landmarks?.[61];
        const rightCorner = landmarks?.[291];

        if (!landmarks || !upperLip || !lowerLip || !leftCorner || !rightCorner || jawOpen < 0.38) {
            vomitOverlay.style.opacity = "0";
            vomitShape.setAttribute("opacity", "0");
            return;
        }

        const width = Math.hypot(
            (rightCorner.x - leftCorner.x) * video.videoWidth,
            (rightCorner.y - leftCorner.y) * video.videoHeight
        );
        const mouthGap = Math.hypot(
            (lowerLip.x - upperLip.x) * video.videoWidth,
            (lowerLip.y - upperLip.y) * video.videoHeight
        );
        const centerX = (leftCorner.x + rightCorner.x) * 0.5 * video.videoWidth;
        const mouthBottomY = Math.max(upperLip.y, lowerLip.y) * video.videoHeight;

        // El efecto crece con la apertura de la mandíbula, sin dejar rastros.
        const effectWidth = Math.max(width * 0.92, 18);
        const effectHeight = Math.max(mouthGap * 2.8, width * 0.72);
        const startY = mouthBottomY - effectHeight * 0.08;

        vomitShape.setAttribute(
            "transform",
            `translate(${centerX - effectWidth / 2} ${startY}) scale(${effectWidth} ${effectHeight})`
        );
        vomitShape.setAttribute("opacity", String(Math.min(1, 0.72 + jawOpen * 0.5)));
        vomitOverlay.setAttribute("viewBox", `0 0 ${video.videoWidth} ${video.videoHeight}`);
        vomitOverlay.style.opacity = "1";
    }


    // La mascara sale del grupo de la escena: se coloca vertice a vertice en la cara.
    // Sus hijos (si alguien los emparento en el editor) se quedan en la escena
    // para que sigan la cabeza como el resto de objetos.
    const mask = player.rootNode.getObjectByName(MASK_NAME);
    if (mask) {
        for (const child of [...mask.children]) mask.parent.attach(child);
        faceRenderer.faceGroup.add(mask);
    } else {
        console.warn(`La escena no tiene un objeto "${MASK_NAME}": no habra mascara facial.`);
    }

    const settings = { headScale: 1 };

    function update() {

        tracker.update();
        faceEvents.update(tracker);

        const landmarks = tracker.getLandmarks();
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
