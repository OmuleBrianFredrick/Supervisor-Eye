import React, { useState } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  Search, 
  MapPin, 
  Loader2, 
  Download, 
  Maximize2,
  Type as TypeIcon,
  Layout
} from 'lucide-react';
import { generateImage, generateVideo, textToSpeech } from '../services/aiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AITools() {
  const [activeTool, setActiveTool] = useState<'image' | 'video' | 'tts'>('image');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  // Image Config
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [aspectRatio, setAspectRatio] = useState("1:1");

  // Video Config
  const [videoAspectRatio, setVideoAspectRatio] = useState<"16:9" | "9:16">("16:9");

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setResult(null);

    try {
      if (activeTool === 'image') {
        const url = await generateImage(prompt, imageSize, aspectRatio);
        setResult(url || null);
      } else if (activeTool === 'video') {
        const url = await generateVideo(prompt, videoAspectRatio);
        setResult(url || null);
      } else if (activeTool === 'tts') {
        const base64 = await textToSpeech(prompt);
        if (base64) {
          setResult(`data:audio/mp3;base64,${base64}`);
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">AI Creative Studio</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Generate visual and audio assets using Gemini & Veo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tools */}
        <div className="lg:col-span-1 space-y-2">
          <button
            onClick={() => { setActiveTool('image'); setResult(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
              activeTool === 'image' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
            )}
          >
            <ImageIcon className="w-5 h-5" />
            Image Generation
          </button>
          <button
            onClick={() => { setActiveTool('video'); setResult(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
              activeTool === 'video' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
            )}
          >
            <Video className="w-5 h-5" />
            Video Generation
          </button>
          <button
            onClick={() => { setActiveTool('tts'); setResult(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
              activeTool === 'tts' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
            )}
          >
            <Mic className="w-5 h-5" />
            Text to Speech
          </button>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                {activeTool === 'tts' ? 'Text to Speak' : 'Generation Prompt'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTool === 'tts' ? "Enter text to convert to speech..." : "Describe what you want to create in detail..."}
                className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Tool Specific Config */}
            {activeTool === 'image' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Image Size</label>
                  <div className="flex gap-2">
                    {["1K", "2K", "4K"].map(s => (
                      <button
                        key={s}
                        onClick={() => setImageSize(s as any)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          imageSize === s 
                            ? "bg-indigo-600 border-indigo-600 text-white" 
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 outline-none"
                  >
                    <option value="1:1">1:1 Square</option>
                    <option value="3:4">3:4 Portrait</option>
                    <option value="4:3">4:3 Landscape</option>
                    <option value="9:16">9:16 Story</option>
                    <option value="16:9">16:9 Cinematic</option>
                    <option value="21:9">21:9 Ultrawide</option>
                  </select>
                </div>
              </div>
            )}

            {activeTool === 'video' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Aspect Ratio</label>
                <div className="flex gap-2">
                  {[
                    { label: 'Landscape (16:9)', value: '16:9' },
                    { label: 'Portrait (9:16)', value: '9:16' }
                  ].map(r => (
                    <button
                      key={r.value}
                      onClick={() => setVideoAspectRatio(r.value as any)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold border transition-all",
                        videoAspectRatio === r.value 
                          ? "bg-indigo-600 border-indigo-600 text-white" 
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}
                </>
              )}
            </button>
          </div>

          {/* Result Area */}
          <div className="bg-slate-100 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 min-h-[400px] flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {!result && !isLoading && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  {activeTool === 'image' ? <ImageIcon className="w-8 h-8 text-slate-300" /> : activeTool === 'video' ? <Video className="w-8 h-8 text-slate-300" /> : <Mic className="w-8 h-8 text-slate-300" />}
                </div>
                <p className="text-slate-400 text-sm font-medium">Your generated content will appear here</p>
              </div>
            )}

            {isLoading && (
              <div className="text-center space-y-4 z-10">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                  <Sparkles className="w-8 h-8 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-900 dark:text-white font-bold">AI is working its magic...</p>
                  <p className="text-slate-500 text-xs">This may take a few moments for high-quality results.</p>
                </div>
              </div>
            )}

            {result && !isLoading && (
              <div className="w-full h-full flex flex-col items-center gap-6 animate-in zoom-in duration-300">
                {activeTool === 'image' && (
                  <div className="relative group w-full max-w-2xl">
                    <img src={result} alt="AI Generated" className="w-full rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-4">
                      <a href={result} download="ai-image.png" className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform">
                        <Download className="w-6 h-6" />
                      </a>
                    </div>
                  </div>
                )}
                {activeTool === 'video' && (
                  <div className="w-full max-w-2xl space-y-4">
                    <video src={result} controls className="w-full rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800" />
                    <a href={result} download="ai-video.mp4" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-xl font-bold">
                      <Download className="w-5 h-5" />
                      Download Video
                    </a>
                  </div>
                )}
                {activeTool === 'tts' && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md text-center space-y-6">
                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto">
                      <Mic className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <audio src={result} controls className="w-full" />
                    <p className="text-xs text-slate-500 italic">" {prompt.slice(0, 50)}... "</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
