'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth, db, storage } from '../firebaseConfig';
import { collection, serverTimestamp, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, orderBy, arrayUnion, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBlob, deleteObject } from 'firebase/storage';
import JSZip from 'jszip';
import { AppShell } from './components/shell/AppShell';
import { RecordsView } from './components/records/RecordsView';
import { FichaForm } from './components/ficha/FichaForm';
import { FichaDetalle } from './components/ficha/FichaDetalle';
import { EscanerCodigoBarras } from './components/ficha/EscanerCodigoBarras';
import { decodeDniBarcode } from './lib/decodeDniBarcode';
import { parsedDniToFormFields } from './lib/parseDniPdf417';
import { ControlView } from './components/control/ControlView';
import { UsuariosView } from './components/users/UsuariosView';
import { Login, PerfilPendiente } from './components/auth/AuthScreens';
import type { Rol } from './lib/types';
import type { TabKey } from './components/shell/nav';

const IconNueva = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const IconFichas = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75c.621 0 1.125.504 1.125 1.125v1.875c0 .621-.504 1.125-1.125 1.125H5.625a1.125 1.125 0 0 1-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125Z" /></svg>;
const IconUsuarios = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>;
const IconControl = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>;

const DNI_CAPTURE_MAX_WIDTH = 1800;
const DNI_CAPTURE_JPEG_QUALITY = 0.87;

type RecorteDniPendiente = {
  cara: 'frente' | 'dorso';
  imagen: string;
  siguienteImagen?: string;
};

const EscanerDocumento = ({ onClose, onCapture, titulo, tipo = 'dni', imagenInicial }: { onClose: () => void, onCapture: (imgData: string, originalFile?: File) => void, titulo: string, tipo?: 'dni' | 'ficha', imagenInicial?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const nativeImgRef = useRef<HTMLImageElement>(null);
  const nativeWrapRef = useRef<HTMLDivElement>(null);
  const nativeObjectUrlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(imagenInicial || null);
  const [nativeDisplayed, setNativeDisplayed] = useState<{ w: number; h: number } | null>(null);
  const [nativeCrop, setNativeCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const proporcionMarco = tipo === 'ficha' ? 'aspect-[1.66]' : 'aspect-[1.58]';
  const usarCamaraNativa = tipo === 'dni';
  const ladoDni = titulo.toLowerCase().includes('frente') ? 'frente' : titulo.toLowerCase().includes('dorso') ? 'dorso' : 'dni';
  const ladoDniLabel = ladoDni === 'frente' ? 'frente del DNI' : ladoDni === 'dorso' ? 'dorso del DNI' : 'DNI';

  useEffect(() => {
    if (usarCamaraNativa) return;

    let currentStream: MediaStream;
    const encenderCamara = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        currentStream = stream;
      } catch (err) {
        alert("No se pudo acceder a la cÃ¡mara.");
        onClose();
      }
    };
    encenderCamara();
    return () => { if (currentStream) currentStream.getTracks().forEach(t => t.stop()); };
  }, [onClose, usarCamaraNativa]);

  useEffect(() => {
    return () => {
      if (nativeObjectUrlRef.current) {
        URL.revokeObjectURL(nativeObjectUrlRef.current);
      }
    };
  }, []);

  const limpiarPreviewNativa = () => {
    if (nativeObjectUrlRef.current) {
      URL.revokeObjectURL(nativeObjectUrlRef.current);
      nativeObjectUrlRef.current = null;
    }
    setPreview(null);
    setNativeDisplayed(null);
  };

  const tomarFotoNativa = async (file: File) => {
    limpiarPreviewNativa();
    if (!('createImageBitmap' in window)) {
      nativeObjectUrlRef.current = URL.createObjectURL(file);
      setPreview(nativeObjectUrlRef.current);
      return;
    }

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const maxSide = 2200;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar la foto del DNI.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setPreview(canvas.toDataURL('image/jpeg', 0.9));
      canvas.width = 0;
      canvas.height = 0;
    } catch {
      nativeObjectUrlRef.current = URL.createObjectURL(file);
      setPreview(nativeObjectUrlRef.current);
    } finally {
      bitmap?.close();
    }
  };

  const recalcularRecorteNativo = () => {
    const img = nativeImgRef.current;
    const wrap = nativeWrapRef.current;
    if (!img || !wrap || !img.naturalWidth) return;

    const rect = wrap.getBoundingClientRect();
    const aspect = img.naturalWidth / img.naturalHeight;
    let w: number;
    let h: number;

    if (rect.width / aspect <= rect.height) {
      w = rect.width;
      h = rect.width / aspect;
    } else {
      h = rect.height;
      w = rect.height * aspect;
    }

    setNativeDisplayed({ w, h });
    const cropAspect = 1.58;
    let cropW = w * 0.94;
    let cropH = cropW / cropAspect;
    if (cropH > h * 0.94) {
      cropH = h * 0.94;
      cropW = cropH * cropAspect;
    }
    setNativeCrop({ x: (w - cropW) / 2, y: (h - cropH) / 2, w: cropW, h: cropH });
  };

  const moverRecorteNativo = (e: React.PointerEvent) => {
    if (!nativeDisplayed) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...nativeCrop };

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setNativeCrop({
        ...startCrop,
        x: Math.max(0, Math.min(nativeDisplayed.w - startCrop.w, startCrop.x + dx)),
        y: Math.max(0, Math.min(nativeDisplayed.h - startCrop.h, startCrop.y + dy)),
      });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const ajustarTamanoRecorteNativo = (delta: number) => {
    if (!nativeDisplayed) return;
    const aspect = 1.58;
    const nextW = Math.max(120, Math.min(nativeDisplayed.w, nativeCrop.w + delta));
    const nextH = nextW / aspect;
    if (nextH > nativeDisplayed.h) return;

    setNativeCrop(prev => {
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return {
        x: Math.max(0, Math.min(nativeDisplayed.w - nextW, cx - nextW / 2)),
        y: Math.max(0, Math.min(nativeDisplayed.h - nextH, cy - nextH / 2)),
        w: nextW,
        h: nextH,
      };
    });
  };

  const usarRecorteNativo = () => {
    const img = nativeImgRef.current;
    if (!img || !nativeDisplayed || !preview) return;

    const scaleX = img.naturalWidth / nativeDisplayed.w;
    const scaleY = img.naturalHeight / nativeDisplayed.h;
    const sx = nativeCrop.x * scaleX;
    const sy = nativeCrop.y * scaleY;
    const sw = nativeCrop.w * scaleX;
    const sh = nativeCrop.h * scaleY;

    const canvas = document.createElement('canvas');
    const outputScale = sw > DNI_CAPTURE_MAX_WIDTH ? DNI_CAPTURE_MAX_WIDTH / sw : 1;
    canvas.width = Math.round(sw * outputScale);
    canvas.height = Math.round(sh * outputScale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', DNI_CAPTURE_JPEG_QUALITY));
    limpiarPreviewNativa();
  };

  const tomarFoto = () => {
    const video = videoRef.current;
    const marco = marcoRef.current;
    if (!video || !marco) return;

    const canvas = document.createElement('canvas');
    const videoRect = video.getBoundingClientRect();
    const marcoRect = marco.getBoundingClientRect();

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const margenX = marcoRect.width * 0.05;
    const margenY = marcoRect.height * 0.05;

    const sx = Math.max(0, (marcoRect.left - videoRect.left - margenX) * scaleX);
    const sy = Math.max(0, (marcoRect.top - videoRect.top - margenY) * scaleY);
    const sWidth = Math.min(video.videoWidth - sx, (marcoRect.width + margenX * 2) * scaleX);
    const sHeight = Math.min(video.videoHeight - sy, (marcoRect.height + margenY * 2) * scaleY);

    canvas.width = sWidth;
    canvas.height = sHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (tipo === 'ficha') {
        ctx.filter = 'contrast(1.5) grayscale(100%)';
      }
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreview(dataUrl);
    }
  };

  if (usarCamaraNativa) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col">
        <div className="p-4 bg-black text-white flex justify-between items-center z-10">
          <h3 className="font-bold text-lg">{titulo}</h3>
          <button onClick={onClose} className="text-white font-bold px-3 py-1 bg-red-600 rounded">Cerrar</button>
        </div>

        {preview ? (
          <>
            <div ref={nativeWrapRef} className="flex-1 relative bg-black flex items-center justify-center min-h-0 overflow-hidden p-3">
              <div className="relative touch-none select-none" style={nativeDisplayed ? { width: nativeDisplayed.w, height: nativeDisplayed.h } : { width: 1, height: 1, opacity: 0 }}>
                <img
                  ref={nativeImgRef}
                  src={preview}
                  alt="Foto del DNI"
                  draggable={false}
                  onLoad={recalcularRecorteNativo}
                  className="block w-full h-full pointer-events-none"
                />
                {nativeDisplayed && (
                  <div
                    className="absolute border-4 border-emerald-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] cursor-move"
                    style={{ left: nativeCrop.x, top: nativeCrop.y, width: nativeCrop.w, height: nativeCrop.h, touchAction: 'none' }}
                    onPointerDown={moverRecorteNativo}
                  >
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded bg-black/45 text-white/80 text-xs font-bold uppercase tracking-wide pointer-events-none">
                      {ladoDni === 'dni' ? 'DNI' : ladoDni}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black p-3 md:p-4 shrink-0">
              <div className="flex gap-2 mb-2">
                <button onClick={() => ajustarTamanoRecorteNativo(-40)} className="flex-1 py-3 rounded-lg bg-slate-800 text-white font-bold text-sm active:bg-slate-700">
                  Alejar marco
                </button>
                <button onClick={() => ajustarTamanoRecorteNativo(40)} className="flex-1 py-3 rounded-lg bg-slate-800 text-white font-bold text-sm active:bg-slate-700">
                  Agrandar marco
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={imagenInicial ? onClose : limpiarPreviewNativa} className="flex-1 py-3 rounded-lg bg-white text-slate-900 font-bold text-sm active:bg-slate-100">
                  {imagenInicial ? 'Cancelar' : 'Reintentar'}
                </button>
                <button onClick={usarRecorteNativo} className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-bold text-sm active:bg-emerald-700">
                  Usar recorte
                </button>
              </div>
            </div>
          </>
        ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
          <p className="text-center mb-1 max-w-sm text-base font-semibold">Cargar {ladoDniLabel}</p>
          <p className="text-center text-white/60 text-sm max-w-sm mb-6">
            Sacá una foto con la cámara o elegí una imagen de la galería. Después vas a poder recortar el DNI.
          </p>
          <div className="w-full max-w-sm grid gap-2.5">
            <label className="block w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg text-center cursor-pointer active:bg-emerald-700">
              Abrir cámara
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) tomarFotoNativa(file);
                  e.target.value = '';
                }}
              />
            </label>
            <label className="block w-full py-3.5 rounded-lg bg-white text-slate-900 font-bold text-sm shadow-lg text-center cursor-pointer active:bg-slate-100">
              Elegir de galería
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) tomarFotoNativa(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center z-10">
        <h3 className="font-bold text-lg">{titulo}</h3>
        <button onClick={onClose} className="text-white font-bold px-3 py-1 bg-red-600 rounded">Cerrar</button>
      </div>
      
      <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${preview ? 'hidden' : ''}`}>
        <video ref={videoRef} autoPlay playsInline className="absolute w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
        <div ref={marcoRef} className={`relative w-[85%] ${proporcionMarco} border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none`}>
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
          <p className="absolute inset-0 flex items-center justify-center text-white/50 font-bold text-lg uppercase tracking-widest text-center">
            {tipo === 'ficha' ? 'Alinee la ficha' : 'Alinee el DNI'}
          </p>
        </div>
      </div>
      
      {!preview && (
        <div className="h-32 bg-black flex items-center justify-center pb-8 z-10">
          <button onClick={tomarFoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 active:bg-gray-200 transition shadow-[0_0_15px_rgba(255,255,255,0.5)]"></button>
        </div>
      )}

      {preview && (
        <div className="flex-1 flex flex-col bg-black">
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={preview} alt="Vista previa" className="max-w-full max-h-full rounded-xl border-2 border-gray-500 shadow-2xl" />
          </div>
          <div className="h-32 bg-black flex items-center justify-center gap-4 pb-8 z-10 px-4">
            <button onClick={() => setPreview(null)} className="flex-1 py-4 bg-gray-800 text-white font-black uppercase tracking-wide rounded-xl active:bg-gray-700 transition">
              Reintentar
            </button>
            <button onClick={() => onCapture(preview)} className="flex-1 py-4 bg-green-600 text-white font-black uppercase tracking-wide rounded-xl active:bg-green-500 transition">
              Usar Foto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const { user, loading, role, userData, isAdmin, isSupervisor, isAdminOrSupervisor, loginConGoogle, logout } = useAuth();
  
  const tieneRetornoDidit = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('didit_session') !== null;
  const [mostrarIntro, setMostrarIntro] = useState(!tieneRetornoDidit);

  useEffect(() => {
    if (tieneRetornoDidit) return;
    const timer = setTimeout(() => setMostrarIntro(false), 6000);
    return () => clearTimeout(timer);
  }, [tieneRetornoDidit]);

  const [tab, setTab] = useState<'nueva' | 'registros' | 'usuarios' | 'detalle' | 'editar' | 'control'>('registros');
  
  const [formData, setFormData] = useState({
    tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', 
    sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', 
    nacionalidad: 'Argentina', profesion: '', estadoCivil: '', 
    celular: '', mail: '',
    distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '',
    localidad: '', observaciones: '', estadoControl: 'pendiente'
  });
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [fichaSeleccionada, setFichaSeleccionada] = useState<any>(null);
  
  const [modoArchivo, setModoArchivo] = useState<'escaner' | 'unico'>('escaner');
  const [camaraActiva, setCamaraActiva] = useState<null | 'frente' | 'dorso' | 'fichaControl'>(null);
  const [escaneoDniGuiado, setEscaneoDniGuiado] = useState(false);
  const [continuacionDniPendiente, setContinuacionDniPendiente] = useState<null | 'dorso'>(null);
  const [dniDatosLeidos, setDniDatosLeidos] = useState(false);
  const [escanerBarcodeAbierto, setEscanerBarcodeAbierto] = useState(false);
  const [decodeStatus, setDecodeStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [fotoFrenteB64, setFotoFrenteB64] = useState<string | null>(null);
  const [fotoDorsoB64, setFotoDorsoB64] = useState<string | null>(null);
  const [recorteDniPendiente, setRecorteDniPendiente] = useState<RecorteDniPendiente | null>(null);
  const [procesandoArchivoDni, setProcesandoArchivoDni] = useState(false);
  
  const [subiendo, setSubiendo] = useState(false);
  const [creandoPublicLink, setCreandoPublicLink] = useState(false);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [descargandoZip, setDescargandoZip] = useState<string | null>(null);
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroAfiliador, setFiltroAfiliador] = useState('todas');

  const [editandoUsuarioId, setEditandoUsuarioId] = useState<string | null>(null);
  const [formEditUsuario, setFormEditUsuario] = useState({ nombre: '', apellido: '' });
  const [formPerfil, setFormPerfil] = useState({ nombre: '', apellido: '' });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [filtroControl, setFiltroControl] = useState('todas');
  const [filtroControlAfiliador, setFiltroControlAfiliador] = useState('todas');
  const [busquedaControl, setBusquedaControl] = useState('');
  const [fichaControlDetalleId, setFichaControlDetalleId] = useState<string | null>(null);
  const [textoErrorJE, setTextoErrorJE] = useState('');
  const [textoSuspension, setTextoSuspension] = useState('');
  const [accionSuspension, setAccionSuspension] = useState<'suspendido' | 'baja' | null>(null);
  const [subiendoControl, setSubiendoControl] = useState(false);

const [iniciandoSesionDidit, setIniciandoSesionDidit] = useState(false);
  const [diditProcesandoRetorno, setDiditProcesandoRetorno] = useState(false);
  const [diditError, setDiditError] = useState<string | null>(null);
  const [diditMensajePendiente, setDiditMensajePendiente] = useState<string | null>(null);
  const [diditAutocompleted, setDiditAutocompleted] = useState(false);
  const [diditCamposAutocompletados, setDiditCamposAutocompletados] = useState<Set<string>>(new Set());
  const [diditFrenteStorageUrl, setDiditFrenteStorageUrl] = useState<string | null>(null);
  const [diditDorsoStorageUrl, setDiditDorsoStorageUrl] = useState<string | null>(null);
  const [diditFrenteStoragePath, setDiditFrenteStoragePath] = useState<string | null>(null);
  const [diditDniImageUrl, setDiditDniImageUrl] = useState<string | null>(null);
  const [diditDniImagePath, setDiditDniImagePath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.history.state) {
      window.history.replaceState({ tab: 'registros' }, '', '');
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        setTab(e.state.tab);
      } else {
        setTab('registros');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let sessionId = params.get('didit_session');

    if (!sessionId) {
      sessionId = localStorage.getItem('didit_session_pendiente');
    }

    if (!sessionId) return;

    localStorage.removeItem('didit_session_pendiente');
    history.replaceState(null, '', window.location.pathname);

    setTab('nueva');
    setDiditProcesandoRetorno(true);
    setDiditError('');

    let intentos = 0;
    const maxIntentos = 60;
    let cancelado = false;

    const poll = async () => {
      while (intentos < maxIntentos && !cancelado) {
        intentos++;

        const currentUser = auth.currentUser;
        if (!currentUser) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        try {
          const token = await currentUser.getIdToken();
          const res = await fetch(`/api/renaper/estado?session_id=${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.status === 'completado' && data.datos) {
              const raw: Record<string, unknown> = data.datos;
              const campos: Record<string, string> = {};
              const completados = new Set<string>();
              const tryAdd = (key: string, val: unknown) => {
                if (!val) return;
                const str = key === 'dni' ? String(val).replace(/\D/g, '') : String(val);
                if (str) { campos[key] = str; completados.add(key); }
              };
              tryAdd('dni', raw.dni);
              tryAdd('nombres', raw.nombres);
              tryAdd('apellidos', raw.apellidos);
              tryAdd('sexo', raw.sexo);
              tryAdd('fechaNacimiento', raw.fechaNacimiento);
              if (campos.fechaNacimiento) {
                const partes = (campos.fechaNacimiento as string).split('/');
                if (partes.length === 3 && partes[2]) {
                  campos.clase = partes[2];
                  completados.add('clase');
                }
              }
              tryAdd('nacionalidad', raw.nacionalidad);
              tryAdd('lugarNacimiento', raw.lugarNacimiento);
              tryAdd('calle', raw.calle);
              tryAdd('numero', raw.numero);
              const LOCALIDADES_VALIDAS = ['Acassuso', 'Beccar', 'Boulogne', 'Martínez', 'San Isidro', 'Villa Adelina'];
              if (raw.localidad && LOCALIDADES_VALIDAS.includes(String(raw.localidad))) {
                tryAdd('localidad', raw.localidad);
              }
              setFormData(prev => ({ ...prev, ...campos }));
              setDiditCamposAutocompletados(completados);
              setDiditAutocompleted(completados.size > 0);
              if (raw.frontImageStorageUrl)  setDiditFrenteStorageUrl(String(raw.frontImageStorageUrl));
              if (raw.backImageStorageUrl)   setDiditDorsoStorageUrl(String(raw.backImageStorageUrl));
              if (raw.frontImageStoragePath) setDiditFrenteStoragePath(String(raw.frontImageStoragePath));
              if (raw.dniImageStorageUrl)    setDiditDniImageUrl(String(raw.dniImageStorageUrl));
              if (raw.dniImageStoragePath)   setDiditDniImagePath(String(raw.dniImageStoragePath));
              localStorage.removeItem('didit_session_pendiente');
              setDiditProcesandoRetorno(false);
              return;
            }
          }
        } catch (e) {
          console.error('Error polling Didit:', e);
        }

        await new Promise(r => setTimeout(r, 3000));
      }

      if (!cancelado) {
        localStorage.removeItem('didit_session_pendiente');
        setDiditProcesandoRetorno(false);
        setDiditError('El escaneo está tardando. Podés completar los datos manualmente o intentar de nuevo.');
      }
    };

    poll();
    return () => { cancelado = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarTab = (nuevoTab: 'nueva' | 'registros' | 'usuarios' | 'detalle' | 'editar' | 'control') => {
    setTab(nuevoTab);
    window.history.pushState({ tab: nuevoTab }, '', '');
  };

  useEffect(() => {
    if (!user || role === 'pendiente') return;
    const q = isAdminOrSupervisor
      ? query(collection(db, 'afiliaciones'), orderBy('fecha', 'desc'))
      : query(collection(db, 'afiliaciones'), where('afiliadorUid', '==', (user as any).uid));
    return onSnapshot(q, (snapshot) => setRegistros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [user, isAdminOrSupervisor, role]);

  useEffect(() => {
    if (!isAdminOrSupervisor) return;
    const q = query(collection(db, 'usuarios'), orderBy('fechaRegistro', 'desc'));
    return onSnapshot(q, (snapshot) => setUsuariosSistema(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [isAdminOrSupervisor]);

  const estadoControlCfg: Record<string, { label: string; cls: string }> = {
    pendiente:  { label: 'Pendiente',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    firmado:    { label: 'Firmada',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    escaneado:  { label: 'Escaneada',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    cargado_je: { label: 'En JE',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    aprobado:   { label: 'Aprobada',    cls: 'bg-green-100 text-green-700 border-green-200' },
    error:      { label: 'Con Error',   cls: 'bg-red-50 text-red-700 border-red-200' },
    suspendido: { label: 'Suspendido',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    baja:       { label: 'Dado de baja', cls: 'bg-red-100 text-red-800 border-red-300' },
  };

  const fmtTs = (ts: any): string => {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const registrosFiltrados = registros.filter((reg) => {
    if (isAdminOrSupervisor && filtroAfiliador !== 'todas' && reg.afiliadorUid !== filtroAfiliador) {
      return false;
    }
    
    if (busqueda.trim() !== '') {
      const b = busqueda.toLowerCase().trim();
      const coincideDni = reg.dni?.toLowerCase().includes(b);
      const coincideNombres = reg.nombres?.toLowerCase().includes(b);
      const coincideApellidos = reg.apellidos?.toLowerCase().includes(b);
      
      if (!coincideDni && !coincideNombres && !coincideApellidos) {
        return false;
      }
    }
    
    return true;
  });

  const registrosControl = isAdmin ? registros.filter((reg) => {
    const estado = reg.estadoControl || 'pendiente';
    if (filtroControl !== 'todas' && estado !== filtroControl) return false;
    if (filtroControlAfiliador !== 'todas' && reg.afiliadorUid !== filtroControlAfiliador) return false;
    if (busquedaControl.trim()) {
      const b = busquedaControl.toLowerCase();
      return reg.dni?.toLowerCase().includes(b) || reg.nombres?.toLowerCase().includes(b) || reg.apellidos?.toLowerCase().includes(b);
    }
    return true;
  }) : [];

  const fichaControlDetalle = fichaControlDetalleId ? (registros.find(r => r.id === fichaControlDetalleId) || null) : null;

  if (mostrarIntro) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center overflow-hidden p-4 md:p-8">
        <video 
          autoPlay 
          muted 
          playsInline 
          preload="auto"
          className="w-full h-full max-w-5xl max-h-[90vh] object-contain"
          onEnded={() => setMostrarIntro(false)} 
          onError={() => setMostrarIntro(false)}
        >
          <source src="/video.mp4" type="video/mp4" />
        </video>
      </div>
    );
  }

  if (loading) return <div className="p-10 text-center font-bold text-gray-900 text-lg">Iniciando SIA...</div>;

  if (!user) return <Login onLogin={loginConGoogle} />;

  if (role === 'pendiente') {
    return (
      <PerfilPendiente
        etapa={(userData as any)?.perfilCompleto ? 'espera' : 'form'}
        nombre={(userData as any)?.nombre}
        apellido={(userData as any)?.apellido}
        guardando={guardandoPerfil}
        onLogout={logout}
        onSubmit={async ({ nombre, apellido }) => {
          if (!user) return;
          setGuardandoPerfil(true);
          try {
            await updateDoc(doc(db, 'usuarios', (user as any).uid), {
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              perfilCompleto: true,
            });
            (user as any).getIdToken().then((idToken: string) => {
              fetch('/api/notificar-nuevo-usuario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ email: (user as any).email, nombre: `${nombre.trim()} ${apellido.trim()}` }),
              });
            }).catch(() => {});
          } catch {
            alert('Error al guardar. Intentá de nuevo.');
          } finally {
            setGuardandoPerfil(false);
          }
        }}
      />
    );
  }
  const iniciarSesionDidit = async () => {
    if (!user) return;
    setIniciandoSesionDidit(true);
    setDiditError(null);
    setDiditMensajePendiente(null);
    try {
      const idToken = await (user as any).getIdToken();
      const nombreAfiliador = userData
        ? `${(userData as any).apellido || ''} ${(userData as any).nombre || ''}`.trim()
        : ((user as any).displayName || '');
      const res = await fetch('/api/renaper/iniciar-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ afiliadorUid: (user as any).uid, afiliadorNombre: nombreAfiliador }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Error al iniciar sesión con Didit');
      }
      const { sessionId, url } = await res.json();
      localStorage.setItem('didit_session_pendiente', sessionId);
      window.location.href = url;
    } catch (err: any) {
      setDiditError(err.message || 'No se pudo iniciar el escaneo. Intentá de nuevo.');
      setIniciandoSesionDidit(false);
    }
  };

  const actualizarRol = async (uid: string, nuevoRol: string) => {
    try {
      await updateDoc(doc(db, 'usuarios', uid), { rol: nuevoRol });
    } catch (e) {
      alert('Error de red');
    }
  };

  const guardarNombreUsuario = async () => {
    if (!editandoUsuarioId) return;
    try {
      await updateDoc(doc(db, 'usuarios', editandoUsuarioId), {
        nombre: formEditUsuario.nombre.trim(),
        apellido: formEditUsuario.apellido.trim()
      });
      setEditandoUsuarioId(null);
    } catch {
      alert('Error al guardar');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'fechaNacimiento') {
      if (value.length < formData.fechaNacimiento.length) {
        setFormData({ ...formData, [name]: value }); return;
      }
      let val = value.replace(/\D/g, '');
      if (val.length > 8) val = val.substring(0, 8);
      let formatted = val;
      if (val.length > 4) formatted = `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4)}`;
      else if (val.length > 2) formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
      setFormData({ ...formData, [name]: formatted });
    } else if (name === 'clase') {
      let val = value.replace(/\D/g, '');
      if (val.length > 4) val = val.substring(0, 4);
      setFormData({ ...formData, [name]: val });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const descargarZip = async (tipo: 'dni' | 'ficha') => {
    if (!isAdmin) {
      alert('Solo un administrador puede descargar archivos.');
      return;
    }

    const conArchivo = registrosFiltrados.filter(r => tipo === 'dni' ? (r.archivoDniPath || r.archivoDni) : (r.archivoFichaPath || r.archivoFicha));
    if (conArchivo.length === 0) {
      alert(`No hay archivos de ${tipo.toUpperCase()} para descargar.`);
      return;
    }
    setDescargandoZip(tipo);
    const zip = new JSZip();
    const CONCURRENCIA = 10;
    for (let i = 0; i < conArchivo.length; i += CONCURRENCIA) {
      const lote = conArchivo.slice(i, i + CONCURRENCIA);
      await Promise.all(lote.map(async (reg) => {
        try {
          const targetPath = tipo === 'dni' ? reg.archivoDniPath : reg.archivoFichaPath;
          const targetUrl = tipo === 'dni' ? reg.archivoDni : reg.archivoFicha;
          const blob = targetPath
            ? await getBlob(ref(storage, targetPath))
            : await (await fetch(targetUrl)).blob();
          const ext = blob.type === 'application/pdf' ? 'pdf' : 'jpg';
          const sufijo = tipo === 'dni' ? 'DNI' : 'FICHA';
          const nombre = `${reg.apellidos}_${reg.nombres}_${reg.dni}_${sufijo}.${ext}`.replace(/\s+/g, '_');
          zip.file(nombre, blob);
        } catch {}
      }));
    }
    const contenido = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(contenido);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tipo === 'dni' ? 'DNIs' : 'Fichas'}_SIA_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDescargandoZip(null);
  };

  const exportarCSV = () => {
    if (!isAdmin) {
      alert('Solo un administrador puede exportar CSV.');
      return;
    }

    if (registrosFiltrados.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const cabeceras = [
      "Estado", "Tipo Doc", "NRO Documento", "Apellidos", "Nombres", "Sexo", "Clase", 
      "Fecha Nacimiento", "Lugar Nacimiento", "Nacionalidad", "ProfesiÃ³n", "Estado Civil",
      "Celular", "Mail", "Distrito", "Localidad", "Calle", "NÃºmero", "Piso", "Dpto", 
      "Observaciones", "Cargado Por", "Link DNI", "Link Ficha"
    ];

    const filas = registrosFiltrados.map(reg => [
      reg.estadoControl || 'pendiente',
      reg.tipoDocumento || 'DNI',
      reg.dni,
      reg.apellidos,
      reg.nombres,
      reg.sexo,
      reg.clase || '',
      reg.fechaNacimiento,
      reg.lugarNacimiento || '',
      reg.nacionalidad,
      reg.profesion || '',
      reg.estadoCivil || '',
      reg.celular || '',
      reg.mail || '',
      reg.distrito || 'Buenos Aires',
      reg.localidad,
      reg.calle,
      reg.numero,
      reg.piso || '',
      reg.dpto || '',
      reg.observaciones || '',
      reg.afiliadorNombre || reg.afiliadorEmail || '',
      reg.archivoDniPath || reg.archivoDni || 'Sin archivo',
      reg.archivoFichaPath || reg.archivoFicha || 'Sin archivo'
    ]);

    const contenidoCSV = [
      cabeceras.join(","),
      ...filas.map(fila => fila.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Afiliados_SIA_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const procesarDNIUnicoImagen = async (): Promise<Blob> => {
    const getImgObj = (b64: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = b64;
      });
    };

    const imgF = await getImgObj(fotoFrenteB64!);
    const imgD = await getImgObj(fotoDorsoB64!);

    const targetWidth = 1200;
    const scaleF = targetWidth / imgF.width;
    const targetHeightF = imgF.height * scaleF;

    const scaleD = targetWidth / imgD.width;
    const targetHeightD = imgD.height * scaleD;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeightF + targetHeightD + 20;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgF, 0, 0, targetWidth, targetHeightF);
      ctx.drawImage(imgD, 0, targetHeightF + 20, targetWidth, targetHeightD);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error'));
      }, 'image/jpeg', 0.85);
    });
  };

  const puedeEditarFicha = (ficha: any) => {
    const estado = ficha?.estadoControl || 'pendiente';
    return isAdmin || estado === 'pendiente';
  };

  const eliminarFicha = async (ficha: any) => {
    try {
      // Borrar archivos de Storage (best-effort: si falla, seguimos con Firestore)
      const pathsABorrar = [ficha.archivoDniPath, ficha.archivoFichaPath].filter(Boolean);
      for (const path of pathsABorrar) {
        try {
          await deleteObject(ref(storage, path));
        } catch (e: any) {
          if (e?.code !== 'storage/object-not-found') {
            console.warn('No se pudo borrar archivo de Storage:', path, e?.message);
          }
        }
      }

      const batch = writeBatch(db);
      batch.delete(doc(db, 'afiliaciones', ficha.id));

      const dniNormalizado = String(ficha.dni || '').replace(/\D/g, '');
      if (dniNormalizado) {
        const indiceRef = doc(db, 'dniIndex', dniNormalizado);
        const indiceSnap = await getDoc(indiceRef);
        if (indiceSnap.exists() && indiceSnap.data()?.fichaId === ficha.id) {
          batch.delete(indiceRef);
        }
      }

      await batch.commit();
      setFichaSeleccionada(null);
      cambiarTab('registros');
    } catch (error: any) {
      console.error('Error al eliminar ficha:', error);
      alert(`No se pudo eliminar la ficha: ${error?.code || error?.message || 'verificá tu conexión e intentá de nuevo.'}`);
    }
  };

  const prepararImagenArchivoDni = async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Subí una imagen JPG/PNG o un PDF del DNI.');
    }

    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo leer la imagen del DNI.'));
        image.src = url;
      });

      const scale = img.width > DNI_CAPTURE_MAX_WIDTH ? DNI_CAPTURE_MAX_WIDTH / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar la imagen del DNI.');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      canvas.width = 0;
      canvas.height = 0;
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const renderizarPdfDni = async (file: File): Promise<string[]> => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const cantidad = Math.min(pdf.numPages, 2);
    const paginas: string[] = [];

    try {
      for (let i = 1; i <= cantidad; i++) {
        const page = await pdf.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxSide = 2200;
        const scale = Math.min(2.5, maxSide / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo preparar una página del PDF.');

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        paginas.push(canvas.toDataURL('image/jpeg', 0.9));
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    } finally {
      const destroy = (pdf as { destroy?: () => Promise<void> }).destroy;
      if (destroy) await destroy.call(pdf);
    }

    return paginas;
  };

  const cargarArchivoUnicoDni = async (file: File) => {
    setProcesandoArchivoDni(true);
    try {
      setFotoFrenteB64(null);
      setFotoDorsoB64(null);
      setDecodeStatus('idle');
      setDniDatosLeidos(false);
      setModoArchivo('escaner');

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const paginas = await renderizarPdfDni(file);
        if (paginas.length === 0) throw new Error('El PDF no tiene páginas para procesar.');
        setRecorteDniPendiente({
          cara: 'frente',
          imagen: paginas[0],
          siguienteImagen: paginas[1] || paginas[0],
        });
      } else if (file.type.startsWith('image/')) {
        const imagen = await prepararImagenArchivoDni(file);
        setRecorteDniPendiente({ cara: 'frente', imagen, siguienteImagen: imagen });
      } else {
        alert('Subí una imagen JPG/PNG o un PDF del DNI.');
      }
    } catch (error: any) {
      console.error('Error al procesar archivo del DNI:', error);
      alert(error?.message || 'No se pudo procesar el archivo del DNI.');
    } finally {
      setProcesandoArchivoDni(false);
    }
  };

  const generarLinkCargaPublica = async () => {
    if (!user || role === 'pendiente') {
      alert('Tu usuario todavia no esta habilitado para generar links.');
      return;
    }
    setCreandoPublicLink(true);
    try {
      const idToken = await (user as any).getIdToken();
      const checkRes = await fetch('/api/links-publicos/activo', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (checkRes.ok) {
        const { activo, token: existingToken } = await checkRes.json();
        if (activo && existingToken) {
          const url = `${window.location.origin}/cargar/${existingToken}`;
          setPublicLink(url);
          try { await navigator.clipboard?.writeText(url); } catch {}
          return;
        }
      }

      const token = crypto.randomUUID().replace(/-/g, '');
      const vence = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await setDoc(doc(db, 'linksCargaPublica', token), {
        afiliadorUid: (user as any).uid,
        creadoEn: Timestamp.fromDate(new Date()),
        venceEn: Timestamp.fromDate(vence),
        usado: false,
      });

      const url = `${window.location.origin}/cargar/${token}`;
      setPublicLink(url);
      try {
        await navigator.clipboard?.writeText(url);
      } catch {}
    } catch (error: any) {
      console.error('Error al generar link publico:', error);
      const detalles = error?.code === 'permission-denied'
        ? `\n\nDatos para revisar:\nUID: ${(user as any)?.uid || '-'}\nRol app: ${role || '-'}\nEmail: ${((userData as any)?.email || (user as any)?.email || '-')}`
        : '';
      alert(`No se pudo generar el link: ${error?.message || 'intenta nuevamente.'}${detalles}`);
    } finally {
      setCreandoPublicLink(false);
    }
  };

  const normalizarFichaPayload = (data: any) => ({
    tipoDocumento: data.tipoDocumento || 'DNI',
    dni: String(data.dni || '').replace(/\D/g, ''),
    apellidos: data.apellidos || '',
    nombres: data.nombres || '',
    sexo: data.sexo || '',
    clase: data.clase || '',
    fechaNacimiento: data.fechaNacimiento || '',
    lugarNacimiento: data.lugarNacimiento || '',
    nacionalidad: data.nacionalidad || 'Argentina',
    profesion: data.profesion || '',
    estadoCivil: data.estadoCivil || '',
    celular: data.celular || '',
    mail: data.mail || '',
    distrito: data.distrito || 'Buenos Aires',
    calle: data.calle || '',
    numero: data.numero || '',
    piso: data.piso || '',
    dpto: data.dpto || '',
    localidad: data.localidad || '',
    observaciones: data.observaciones || '',
    estadoControl: data.estadoControl || 'pendiente',
  });

  const guardarFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    const dniNormalizado = String(formData.dni || '').replace(/\D/g, '');
    if (!dniNormalizado) {
      alert('Ingresá un DNI válido antes de guardar.');
      return;
    }
    if (editandoId) {
      const fichaActual = registros.find(r => r.id === editandoId);
      if (!puedeEditarFicha(fichaActual || formData)) {
        alert('La ficha ya fue escaneada. Solo un administrador puede modificarla.');
        return;
      }
    }
    setSubiendo(true);

    try {
      let pathDni = '';
      let urlDni: string | null = null;

      if (diditDniImagePath) {
        // Imagen combinada frente+dorso ya subida por el webhook de Didit. No re-subir.
        pathDni = diditDniImagePath;
        urlDni  = diditDniImageUrl;
      } else if (!editandoId || fotoFrenteB64) {
        const timestamp = Date.now();
        const ownerUid = editandoId
          ? (registros.find(r => r.id === editandoId)?.afiliadorUid || (user as any).uid)
          : (user as any).uid;
        const dniSeguro = String(formData.dni || 'sin-dni').replace(/\D/g, '') || 'sin-dni';
        const ruta = `dnis/${ownerUid}/${dniSeguro}-${timestamp}.jpg`;
        const storageRef = ref(storage, ruta);

        if (modoArchivo === 'escaner' && fotoFrenteB64 && fotoDorsoB64) {
          const blob = await procesarDNIUnicoImagen();
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          pathDni = ruta;
        }
      }

      if (editandoId) {
        const payload: any = { ...normalizarFichaPayload(formData), ultimaModificacion: serverTimestamp(), ...(pathDni && { archivoDniPath: pathDni, archivoDni: urlDni ?? null }) };
        const est = (formData as any).estadoControl || 'pendiente';
        if (isAdmin && ['escaneado', 'cargado_je', 'aprobado', 'error', 'suspendido', 'baja'].includes(est)) {
          payload.editadoPorAdmin = (user as any).displayName || (user as any).email;
          payload.fechaEdicionAdmin = serverTimestamp();
        }
        await updateDoc(doc(db, 'afiliaciones', editandoId), payload);
        alert('Datos actualizados');
      } else {
        const nombreAfiliador = userData ? `${(userData as any).apellido || ''} ${(userData as any).nombre || ''}`.trim() : ((user as any).displayName || '');
        const payload = {
          ...normalizarFichaPayload(formData),
          archivoDniPath: pathDni,
          ...(urlDni ? { archivoDni: urlDni } : {}),
          afiliadorNombre: nombreAfiliador,
          afiliadorEmail: (user as any).email,
          afiliadorUid: (user as any).uid,
          fecha: serverTimestamp(),
        };
        const fichaRef = doc(collection(db, 'afiliaciones'));
        const indiceRef = doc(db, 'dniIndex', payload.dni);
        const indiceExistente = await getDoc(indiceRef);
        if (indiceExistente.exists()) {
          alert('No se puede guardar: ese DNI ya fue cargado en el sistema.');
          return;
        }
        const batch = writeBatch(db);
        batch.set(indiceRef, {
          dni: payload.dni,
          fichaId: fichaRef.id,
          afiliadorUid: (user as any).uid,
          fecha: serverTimestamp(),
        });
        batch.set(fichaRef, payload);
        await batch.commit();
        alert('Registro exitoso');
      }

      setEditandoId(null);
      setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: 'Argentina', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '', estadoControl: 'pendiente' });
      setFotoFrenteB64(null); setFotoDorsoB64(null);
      setRecorteDniPendiente(null);
      setDecodeStatus('idle');
      setEscaneoDniGuiado(false);
      setContinuacionDniPendiente(null);
      setDniDatosLeidos(false);
      setPublicLink(null);
      setDiditAutocompleted(false);
      setDiditCamposAutocompletados(new Set());
      setDiditFrenteStorageUrl(null); setDiditDorsoStorageUrl(null); setDiditFrenteStoragePath(null);
      setDiditDniImageUrl(null); setDiditDniImagePath(null);
      cambiarTab('registros');

    } catch (error: any) {
      console.error('Error al guardar ficha:', error);
      if (error?.code === 'already-exists' || error?.message?.toLowerCase?.().includes('already exists')) {
        alert('No se puede guardar: ese DNI ya fue cargado en el sistema.');
        return;
      }
      if (error?.code === 'permission-denied') {
        alert('No se puede guardar: tu usuario no tiene permisos para registrar esta ficha o falta actualizar las reglas de seguridad.');
        return;
      }
      alert(`Error al guardar: ${error?.code || error?.message || 'desconocido'}`);
    } finally {
      setSubiendo(false);
    }
  };

  const prepararEdicion = (reg: any) => {
    if (!puedeEditarFicha(reg)) {
      alert('La ficha ya fue escaneada. Solo un administrador puede modificarla.');
      return;
    }

    setFormData({
      ...reg,
      tipoDocumento: reg.tipoDocumento || 'DNI',
      clase: reg.clase || '',
      lugarNacimiento: reg.lugarNacimiento || '',
      nacionalidad: reg.nacionalidad || 'Argentina',
      profesion: reg.profesion || '',
      estadoCivil: reg.estadoCivil || '',
      celular: reg.celular || '',
      mail: reg.mail || '',
      distrito: reg.distrito || 'Buenos Aires',
      estadoControl: reg.estadoControl || 'pendiente'
    });
    setEditandoId(reg.id);
    cambiarTab('editar');
  };

  const prepararNueva = () => {
    setEditandoId(null);
    setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: 'Argentina', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '', estadoControl: 'pendiente' });
    setFotoFrenteB64(null); setFotoDorsoB64(null);
    setRecorteDniPendiente(null);
    setDecodeStatus('idle');
    setEscaneoDniGuiado(false);
    setContinuacionDniPendiente(null);
    setDniDatosLeidos(false);
    setPublicLink(null);
    setDiditAutocompleted(false);
    setDiditCamposAutocompletados(new Set());
    setDiditError(null);
    setDiditMensajePendiente(null);
    setDiditFrenteStorageUrl(null); setDiditDorsoStorageUrl(null); setDiditFrenteStoragePath(null);
    setDiditDniImageUrl(null); setDiditDniImagePath(null);
    localStorage.removeItem('didit_session_pendiente');
    cambiarTab('nueva');
  };

  const actualizarControl = async (id: string, estado: string, extras: Record<string, any> = {}) => {
    try {
      const fichaActual = registros.find(r => r.id === id);
      const estadoAnterior = fichaActual?.estadoControl || 'pendiente';
      const u = user as any;
      const operador = u?.displayName || u?.email || 'Usuario';
      const operadorUid = u?.uid || null;
      const esReactivacion = ['suspendido', 'baja'].includes(estadoAnterior) && !['suspendido', 'baja'].includes(estado);
      const comentario = extras.errorJE || extras.suspendidoComentario || extras.reactivacionComentario || null;
      const fechaHistorial = new Date().toISOString();

      const payload: Record<string, any> = {
        estadoControl: estado,
        ...extras,
        fechaUltimoControl: serverTimestamp(),
        ultimoControlPor: operador,
        ultimoControlPorUid: operadorUid,
        historialControl: arrayUnion({
          accion: esReactivacion ? 'reactivacion' : estado,
          estadoAnterior,
          estadoNuevo: estado,
          fecha: fechaHistorial,
          por: operador,
          uid: operadorUid,
          comentario,
        }),
      };

      if (estado === 'escaneado') {
        payload.fechaEscaneado = extras.fechaEscaneado || serverTimestamp();
        payload.escaneadoPor = extras.escaneadoPor || operador;
        payload.escaneadoPorUid = extras.escaneadoPorUid || operadorUid;
      }
      if (estado === 'cargado_je') {
        payload.fechaCargaJE = serverTimestamp();
        payload.cargadoJEPor = operador;
        payload.cargadoJEPorUid = operadorUid;
      }
      if (estado === 'aprobado') {
        payload.fechaAprobacion = serverTimestamp();
        payload.aprobadoPor = operador;
        payload.aprobadoPorUid = operadorUid;
      }
      if (estado === 'error') {
        payload.fechaErrorJE = serverTimestamp();
        payload.errorPor = operador;
        payload.errorPorUid = operadorUid;
      }
      if (estado === 'suspendido') {
        payload.estadoAnterior = estadoAnterior;
        payload.fechaSuspension = serverTimestamp();
        payload.suspendidoPor = operador;
        payload.suspendidoPorUid = operadorUid;
      }
      if (estado === 'baja') {
        payload.estadoAnterior = estadoAnterior;
        payload.fechaBaja = serverTimestamp();
        payload.bajaPor = operador;
        payload.bajaPorUid = operadorUid;
        payload.suspendidoPor = operador;
        payload.suspendidoPorUid = operadorUid;
      }
      if (esReactivacion) {
        payload.fechaReactivacion = serverTimestamp();
        payload.reactivadoPor = operador;
        payload.reactivadoPorUid = operadorUid;
        payload.reactivacionComentario = extras.reactivacionComentario || null;
      }

      await updateDoc(doc(db, 'afiliaciones', id), payload);
    } catch {
      alert('Error al actualizar estado.');
    }
  };

  const subirFichaControlExtra = async (id: string, b64OrFile: string | File) => {
    setSubiendoControl(true);
    const u = user as any;
    try {
      let blob: Blob;
      const contentType = 'image/jpeg';
      const extension = 'jpg';

      if (typeof b64OrFile === 'string') {
        blob = await (await fetch(b64OrFile)).blob();
      } else {
        blob = b64OrFile;
      }

      const storageRef = ref(storage, `fichas/${id}/${Date.now()}.${extension}`);
      await uploadBytes(storageRef, blob, { contentType });
      
      await actualizarControl(id, 'escaneado', {
        archivoFichaPath: storageRef.fullPath,
        fechaEscaneado: serverTimestamp(),
        escaneadoPor: u.displayName || u.email,
        escaneadoPorUid: u.uid,
        fechaFirma: serverTimestamp(),
        firmadoPor: u.displayName || u.email,
        firmadoPorUid: u.uid
      });
    } catch (error: any) {
      console.error("Detalle del error:", error);
      alert(`Error al subir: ${error.message || 'RevisÃ¡ la consola para mÃ¡s detalles.'}`);
    } finally {
      setSubiendoControl(false);
    }
  };

  const afiliadores = usuariosSistema
    .filter(u => u.rol !== 'pendiente')
    .map(u => ({
      uid: u.id,
      nombre: [u.apellido, u.nombre].filter(Boolean).join(', ') || u.email || 'Sin nombre',
    }));
  const roleActual = role as unknown as Rol;

  const navegar = (nuevoTab: TabKey) => {
    if (nuevoTab === 'nueva') {
      prepararNueva();
      return;
    }
    cambiarTab(nuevoTab);
  };

  return (
    <AppShell
      role={roleActual}
      userData={userData as any}
      tab={tab as TabKey}
      search={tab === 'control' ? busquedaControl : busqueda}
      setSearch={tab === 'control' ? setBusquedaControl : setBusqueda}
      onNav={navegar}
      onNueva={prepararNueva}
      onLogout={logout}
    >
      {(camaraActiva || recorteDniPendiente) && (
        <EscanerDocumento
          key={recorteDniPendiente ? recorteDniPendiente.cara : camaraActiva || 'dni'}
          titulo={
            recorteDniPendiente
              ? recorteDniPendiente.cara === 'frente'
                ? 'Recortar Frente DNI'
                : recorteDniPendiente.cara === 'dorso'
                  ? 'Recortar Dorso DNI'
                  : 'Recortar DNI'
              : camaraActiva === 'frente'
                ? 'Escanear Frente DNI'
                : camaraActiva === 'dorso'
                  ? 'Escanear Dorso DNI'
                  : 'Escanear Ficha'
          }
          tipo={camaraActiva?.includes('ficha') ? 'ficha' : 'dni'}
          imagenInicial={recorteDniPendiente?.imagen}
          onClose={() => {
            setEscaneoDniGuiado(false);
            setContinuacionDniPendiente(null);
            setCamaraActiva(null);
            setRecorteDniPendiente(null);
          }}
          onCapture={async (dataUrl) => {
            const recorteActual = recorteDniPendiente;
            const cara = camaraActiva || recorteActual?.cara;
            const continuarConDorso = escaneoDniGuiado && cara === 'frente';
            if (cara === 'frente') setFotoFrenteB64(dataUrl);
            else if (cara === 'dorso') setFotoDorsoB64(dataUrl);
            else if (cara === 'fichaControl') {
              const targetId = fichaControlDetalleId || (fichaSeleccionada ? fichaSeleccionada.id : null);
              if (targetId) subirFichaControlExtra(targetId, dataUrl);
            }
            setCamaraActiva(null);
            if (recorteActual?.cara === 'frente' && recorteActual.siguienteImagen) {
              setRecorteDniPendiente({ cara: 'dorso', imagen: recorteActual.siguienteImagen });
            } else if (recorteActual) {
              setRecorteDniPendiente(null);
            }
            if (continuarConDorso) {
              setContinuacionDniPendiente('dorso');
            }
            // Intento de decode del PDF417 en background (frente o dorso del DNI).
            // Status: processing → success/failed para feedback en la UI.
            if (cara === 'frente' || cara === 'dorso') {
              if (!dniDatosLeidos) {
                setDecodeStatus(prev => prev === 'success' ? 'success' : 'processing');
                try {
                  const parsed = await decodeDniBarcode(dataUrl);
                  if (parsed && (parsed.dni || parsed.apellidos)) {
                    const campos = parsedDniToFormFields(parsed);
                    setFormData(prev => ({ ...prev, ...campos }));
                    setDniDatosLeidos(true);
                    setDecodeStatus('success');
                    console.info('[DNI PDF417] auto-decoded', { cara, raw: parsed.raw, warnings: parsed.warnings });
                  } else {
                    setDecodeStatus(continuarConDorso ? 'idle' : 'failed');
                  }
                } catch {
                  setDecodeStatus(continuarConDorso ? 'idle' : 'failed');
                }
              }
            }
            if (cara === 'dorso') {
              setEscaneoDniGuiado(false);
              setContinuacionDniPendiente(null);
            }
          }}
        />
      )}

      {continuacionDniPendiente === 'dorso' && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Frente guardado</h3>
            <p className="text-sm text-slate-500 mt-1.5">
              Ahora sacá la foto del dorso del DNI. Si el código no estaba en el frente, se va a intentar leer en el dorso.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => {
                  setEscaneoDniGuiado(false);
                  setContinuacionDniPendiente(null);
                }}
                className="flex-1 py-3 rounded-xl bg-white text-slate-700 ring-1 ring-slate-300 font-semibold text-sm active:bg-slate-50"
              >
                Salir
              </button>
              <button
                type="button"
                onClick={() => {
                  setContinuacionDniPendiente(null);
                  setCamaraActiva('dorso');
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm active:bg-emerald-700"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {escanerBarcodeAbierto && (
        <EscanerCodigoBarras
          fotoFrente={fotoFrenteB64}
          fotoDorso={fotoDorsoB64}
          onClose={() => setEscanerBarcodeAbierto(false)}
          onApply={(campos, parsed) => {
            setFormData(prev => ({ ...prev, ...campos }));
            setDecodeStatus('success');
            setEscanerBarcodeAbierto(false);
            console.info('[DNI PDF417] manual decode', { raw: parsed.raw, warnings: parsed.warnings });
          }}
        />
      )}

      {tab === 'registros' && (
        <RecordsView
          role={roleActual}
          registros={registros}
          afiliadores={afiliadores}
          search={busqueda}
          onOpenDetalle={(id) => {
            setFichaSeleccionada(registros.find(r => r.id === id) || null);
            cambiarTab('detalle');
          }}
          onExportCSV={isAdmin ? exportarCSV : undefined}
          onDescargarZip={isAdmin ? () => descargarZip('dni') : undefined}
        />
      )}

      {tab === 'detalle' && fichaSeleccionada && (
        <FichaDetalle
          ficha={fichaSeleccionada}
          role={roleActual}
          onBack={() => cambiarTab('registros')}
          onEdit={prepararEdicion}
          onDelete={puedeEditarFicha(fichaSeleccionada) ? () => eliminarFicha(fichaSeleccionada) : undefined}
        />
      )}

      {(tab === 'nueva' || tab === 'editar') && (
        <FichaForm
          formData={formData}
          onChange={handleChange}
          onSubmit={guardarFicha}
          onCancel={() => cambiarTab('registros')}
          editando={!!editandoId}
          subiendo={subiendo}
          publicLink={publicLink}
          creandoPublicLink={creandoPublicLink}
          onCrearPublicLink={generarLinkCargaPublica}
          dni={{
            modo: modoArchivo,
            setModo: setModoArchivo,
            frenteOk: !!(fotoFrenteB64 || diditDniImageUrl || diditFrenteStorageUrl),
            dorsoOk: !!(fotoDorsoB64 || diditDniImageUrl || diditDorsoStorageUrl),
            fotoFrente: fotoFrenteB64 || diditDniImageUrl || diditFrenteStorageUrl,
            fotoDorso: fotoDorsoB64 || diditDorsoStorageUrl,
            procesandoArchivo: procesandoArchivoDni,
            onScanFrente: () => {
              setEscaneoDniGuiado(false);
              setContinuacionDniPendiente(null);
              setDniDatosLeidos(false);
              setDecodeStatus('idle');
              setRecorteDniPendiente(null);
              setCamaraActiva('frente');
            },
            onScanDorso: () => {
              setEscaneoDniGuiado(false);
              setContinuacionDniPendiente(null);
              setDniDatosLeidos(false);
              setDecodeStatus('idle');
              setRecorteDniPendiente(null);
              setCamaraActiva('dorso');
            },
            onPickFile: cargarArchivoUnicoDni,
            onScanDniData: () => {
              setModoArchivo('escaner');
              setDecodeStatus('idle');
              setDniDatosLeidos(false);
              setContinuacionDniPendiente(null);
              setRecorteDniPendiente(null);
              setEscaneoDniGuiado(true);
              setCamaraActiva('frente');
            },
            onScanBarcode: () => setEscanerBarcodeAbierto(true),
          }}
          decodeStatus={decodeStatus}
          diditLoading={diditProcesandoRetorno}
          diditError={diditError}
          diditMensajePendiente={diditMensajePendiente}
          diditAutocompleted={diditAutocompleted}
          diditCamposAutocompletados={diditCamposAutocompletados}
          onIniciarSesionDidit={!editandoId ? iniciarSesionDidit : undefined}
          iniciandoSesionDidit={iniciandoSesionDidit}
        />
      )}

      {tab === 'usuarios' && isAdminOrSupervisor && (
        <UsuariosView
          role={roleActual}
          usuarios={usuariosSistema}
          actualizarRol={(uid, rol) => actualizarRol(uid, rol)}
          guardarNombre={(uid, datos) => updateDoc(doc(db, 'usuarios', uid), datos)}
        />
      )}

      {tab === 'control' && isAdmin && (
        <ControlView
          fichas={registros}
          afiliadores={afiliadores}
          search={busquedaControl}
          actualizarControl={actualizarControl}
          onOpenFicha={(id) => {
            setFichaSeleccionada(registros.find(r => r.id === id) || null);
            cambiarTab('detalle');
          }}
          onSubirFichaFisica={(id) => {
            setFichaControlDetalleId(id);
            setCamaraActiva('fichaControl');
          }}
        />
      )}
    </AppShell>
  );

}
