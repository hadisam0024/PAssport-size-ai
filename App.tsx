
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import Cropper from 'react-easy-crop';

/**
 * Utility to generate the cropped image for download with strict 35x45 ratio
 */
const getCroppedImg = (imageSrc: string, pixelCrop: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("No 2d context"));
        return;
      }

      // 300 DPI equivalent for 35mm x 45mm
      const targetWidth = 1050; 
      const targetHeight = 1350; 

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = (error) => reject(error);
  });
};

const App: React.FC = () => {
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const faceInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { 
        setFaceImage(ev.target?.result as string);
        setProcessedImage(null); 
        setError(null);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBack = () => {
    setProcessedImage(null);
    setError(null);
  };

  const processImage = async () => {
    if (!faceImage) return;
    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = faceImage.split(',')[1];
      const mimeType = faceImage.split(';')[0].split(':')[1];
      
      // STRICTOR PROMPT FOR POSE LOCK
      const prompt = `DO NOT CHANGE THE PERSON'S POSE, FACE, OR HEAD POSITION. 
      KEEP THE IDENTITY AND PHYSICAL STANCE EXACTLY AS SHOWN.
      ONLY change the clothing to a professional black suit with a crisp white shirt and a solid dark blue tie.
      Change the background to a solid flat royal blue.
      Ensure the lighting is professional studio quality while maintaining the original facial structure perfectly.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { 
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: prompt }
          ] 
        },
        config: {
          imageConfig: { aspectRatio: "3:4" }
        }
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setProcessedImage(`data:image/png;base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("AI failed to lock pose. Try a more direct portrait.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Synthesis disrupted. Check neural link.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!processedImage || !croppedAreaPixels) return;
    try {
      const croppedBase64 = await getCroppedImg(processedImage, croppedAreaPixels);
      const link = document.createElement('a');
      link.href = croppedBase64;
      link.download = `passport_standard_35x45_${Date.now()}.png`;
      link.click();
    } catch (e) {
      console.error(e);
      setError("Export interrupted.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-blue-600/30">
      <header className="py-6 px-4 bg-black border-b border-zinc-900 text-center shadow-2xl relative">
        {processedImage && (
          <button 
            onClick={handleBack}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-all hover:scale-105"
          >
            <i className="fas fa-arrow-left"></i> Back
          </button>
        )}
        <h1 className="text-3xl font-black text-white mb-1 tracking-tighter italic">
          <span className="text-blue-600">WORMGPT</span> PASSPORT <span className="text-blue-500">V4.5</span>
        </h1>
        <p className="text-zinc-600 text-[8px] uppercase tracking-[0.5em] font-bold">Pose Locked // Identity Verified</p>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          <div className="space-y-6">
            <div className="bg-zinc-900/20 border border-zinc-800/50 p-6 rounded-[2rem] backdrop-blur-xl shadow-inner">
              <h2 className="text-[10px] font-black mb-6 text-zinc-500 uppercase tracking-[0.2em] italic border-b border-zinc-800 pb-3 flex justify-between items-center">
                <span>Input Stream</span>
                {!processedImage && <span className="text-blue-500 animate-pulse">● READY</span>}
              </h2>
              
              <div 
                onClick={() => !processedImage && faceInputRef.current?.click()} 
                className={`group relative aspect-[35/45] bg-[#020202] border border-zinc-800 rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden ${!processedImage ? 'cursor-pointer hover:border-blue-600/50' : 'opacity-40 cursor-not-allowed'}`}
              >
                {faceImage ? (
                  <img src={faceImage} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="Source" />
                ) : (
                  <div className="text-center p-10">
                    <div className="w-14 h-14 bg-zinc-900/50 rounded-full flex items-center justify-center mb-5 mx-auto border border-zinc-800 group-hover:bg-blue-600/10 transition-colors">
                      <i className="fas fa-plus text-zinc-600 group-hover:text-blue-500"></i>
                    </div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Select Portrait</p>
                  </div>
                )}
              </div>
              <input type="file" ref={faceInputRef} onChange={handleUpload} className="hidden" accept="image/*" />

              {!processedImage ? (
                <button 
                  onClick={processImage}
                  disabled={isProcessing || !faceImage}
                  className="w-full mt-8 py-5 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-[0.3em] text-[10px] transition-all disabled:opacity-20 hover:bg-blue-500 hover:shadow-[0_0_40px_rgba(37,99,235,0.2)] active:scale-95 flex items-center justify-center gap-3"
                >
                  {isProcessing ? (
                    <>
                      <i className="fas fa-dna animate-spin"></i>
                      Processing Identity...
                    </>
                  ) : 'Synthesize Image'}
                </button>
              ) : (
                <button 
                  onClick={handleBack}
                  className="w-full mt-8 py-5 rounded-2xl bg-zinc-800/50 text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px] transition-all hover:bg-zinc-800 hover:text-white"
                >
                  Restart Buffer
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col h-full">
            <div className="bg-zinc-900/20 border border-zinc-800/50 p-6 rounded-[2rem] backdrop-blur-xl flex-grow flex flex-col shadow-inner">
              <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-3">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] italic">Output Matrix (35x45mm)</h2>
                {processedImage && (
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-bold text-zinc-700 uppercase">Scale:</span>
                    <input 
                      type="range" 
                      min="1" 
                      max="3" 
                      step="0.1" 
                      value={zoom} 
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-20 accent-blue-600 h-0.5 bg-zinc-800 rounded-full appearance-none"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex-grow relative bg-black rounded-2xl overflow-hidden border border-zinc-800/50 min-h-[450px] shadow-2xl">
                {processedImage ? (
                  <Cropper
                    image={processedImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={35/45}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    showGrid={true}
                    style={{
                      containerStyle: { background: '#000' },
                      cropAreaStyle: { border: '1px solid #2563eb', boxShadow: '0 0 0 9999px rgba(0,0,0,0.85)' }
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800 select-none">
                    <i className="fas fa-shield-halved text-7xl opacity-5 mb-6"></i>
                    <p className="text-[8px] uppercase tracking-[0.5em] font-black opacity-30 animate-pulse text-center px-10">Awaiting Signal Synchronization</p>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-900/10 border border-red-900/30 rounded-xl text-center">
                  <p className="text-red-600 text-[9px] font-black uppercase tracking-tighter italic">{error}</p>
                </div>
              )}

              {processedImage && (
                <div className="mt-6 space-y-4">
                  <button 
                    onClick={handleExport} 
                    className="w-full py-5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
                  >
                    Download Master
                  </button>
                  <div className="flex justify-between px-2">
                    <span className="text-[7px] text-zinc-700 uppercase font-bold tracking-widest">35mm x 45mm Locked</span>
                    <span className="text-[7px] text-zinc-700 uppercase font-bold tracking-widest italic">Identity Locked</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
      
      <footer className="py-6 text-center text-zinc-800 text-[8px] uppercase tracking-[0.8em] font-black border-t border-zinc-900 mt-auto">
        XRIVET // NO POSE DRIFT // PRO ONLY \\
      </footer>
    </div>
  );
};

export default App;
