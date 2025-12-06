import React, { useState, useEffect } from 'react';
import { Download, Edit, X, Play, Pause, Scissors, Volume2, Sparkles, Upload, CheckCircle, Youtube, Facebook, Twitter } from 'lucide-react';

const PostStreamFlow = () => {
  const [currentView, setCurrentView] = useState('post-stream');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPosition, setPlayheadPosition] = useState(25);
  const [renderProgress, setRenderProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const streamData = {
    title: 'Weekly Gaming Stream - Dec 6',
    duration: '2:34:15',
    viewers: 247,
    thumbnail: '🎮'
  };

  const clips = [
    { id: 1, start: 0, duration: 35, color: 'from-purple-500 to-pink-500' },
    { id: 2, start: 35, duration: 40, color: 'from-blue-500 to-cyan-500' },
    { id: 3, start: 75, duration: 45, color: 'from-emerald-500 to-teal-500' },
  ];

  // Simulate render progress
  useEffect(() => {
    if (currentView === 'render') {
      const interval = setInterval(() => {
        setRenderProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              const uploadInterval = setInterval(() => {
                setUploadProgress(p => {
                  if (p >= 100) {
                    clearInterval(uploadInterval);
                    return 100;
                  }
                  return p + 2;
                });
              }, 100);
            }, 1000);
            return 100;
          }
          return prev + 1;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [currentView]);

  const renderPostStreamPage = () => (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Stream Complete!</h1>
          <p className="text-zinc-400 text-lg">Great session - 247 viewers watched for 2h 34m</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8">
          <div className="aspect-video bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-8xl relative">
            {streamData.thumbnail}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">{streamData.title}</h2>
                <div className="flex items-center gap-4 text-sm text-zinc-300">
                  <span>Duration: {streamData.duration}</span>
                  <span>•</span>
                  <span>{streamData.viewers} viewers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setCurrentView('editor')}
            className="group relative bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-2 border-purple-500/30 rounded-2xl p-8 hover:scale-105 hover:border-purple-500 transition-all text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-pink-600/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <Edit className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Edit Recording</h3>
              <p className="text-sm text-zinc-400">Cut, trim, and polish your stream</p>
            </div>
          </button>

          <button className="group relative bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-2 border-blue-500/30 rounded-2xl p-8 hover:scale-105 hover:border-blue-500 transition-all text-left overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-cyan-600/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <Download className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Download Now</h3>
              <p className="text-sm text-zinc-400">Get the raw recording (2.1 GB)</p>
            </div>
          </button>

          <button className="group relative bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-8 hover:scale-105 hover:border-zinc-700 transition-all text-left overflow-hidden">
            <div className="relative">
              <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
                <X className="w-7 h-7 text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Exit</h3>
              <p className="text-sm text-zinc-400">Leave without saving</p>
            </div>
          </button>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-400">247</div>
              <div className="text-xs text-zinc-500 mt-1">Peak Viewers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">1,842</div>
              <div className="text-xs text-zinc-500 mt-1">Total Views</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">2h 34m</div>
              <div className="text-xs text-zinc-500 mt-1">Stream Length</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-pink-400">156</div>
              <div className="text-xs text-zinc-500 mt-1">Chat Messages</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditorPage = () => (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentView('post-stream')}
            className="text-zinc-400 hover:text-white transition"
          >
            ← Back
          </button>
          <div>
            <div className="font-semibold">{streamData.title}</div>
            <div className="text-xs text-zinc-500">Editing • Auto-saved 1 min ago</div>
          </div>
        </div>
        <button 
          onClick={() => setCurrentView('render')}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition font-semibold text-sm"
        >
          Continue to Export →
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-4">
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase mb-3">Basic Tools</div>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-sm font-medium hover:bg-purple-500/20 transition">
                  <Scissors className="w-4 h-4 text-purple-400" />
                  <span>Split Clip</span>
                  <kbd className="ml-auto text-xs bg-zinc-800 px-2 py-1 rounded">S</kbd>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-800 text-sm transition">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <span>Adjust Audio</span>
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                AI Tools
                <span className="ml-auto text-purple-400 text-[10px] bg-purple-500/20 px-2 py-1 rounded-full">PRO</span>
              </div>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-sm font-medium">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Remove Silence</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-800 text-sm transition">
                  <span>Add Captions</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-800 text-sm transition">
                  <span>Find Best Moments</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <button className="w-full px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm transition">
                Undo
                <kbd className="ml-2 text-xs bg-zinc-700 px-2 py-1 rounded">⌘Z</kbd>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="bg-black border-b border-zinc-800 p-8 flex items-center justify-center" style={{ height: '50%' }}>
            <div className="relative w-full max-w-4xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20 flex items-center justify-center text-6xl">
                {streamData.thumbnail}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center hover:scale-110 hover:bg-white/20 transition-all"
                >
                  {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-2" />}
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  <div className="text-sm font-mono">00:42:15</div>
                  <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: '27%' }}></div>
                  </div>
                  <div className="text-sm font-mono text-zinc-400">2:34:15</div>
                  <button className="hover:text-purple-400 transition">
                    <Volume2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-zinc-950 p-6 overflow-auto">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Timeline</div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-500">2:34:15 total</div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs transition">−</button>
                  <span className="text-xs text-zinc-500 w-12 text-center">100%</span>
                  <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs transition">+</button>
                </div>
              </div>
            </div>

            <div className="relative h-8 mb-3 border-b border-zinc-800">
              <div className="absolute inset-0 flex text-[10px] text-zinc-500 font-mono">
                {['0:00', '0:30', '1:00', '1:30', '2:00', '2:30'].map((time) => (
                  <div key={time} className="flex-1 flex flex-col items-start">
                    <div className="h-3 w-px bg-zinc-700"></div>
                    <div className="mt-1">{time}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mb-6">
              <div className="text-xs text-zinc-500 mb-2 font-medium flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                </div>
                Video Track
              </div>
              <div className="relative h-24 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden shadow-lg">
                <div className="absolute inset-0 flex gap-1 p-2">
                  {clips.map((clip, index) => (
                    <div
                      key={clip.id}
                      className={`relative bg-gradient-to-br ${clip.color} rounded-lg border-2 border-white/30 hover:border-white/60 transition cursor-pointer group`}
                      style={{ width: `${(clip.duration / 120) * 100}%` }}
                    >
                      <div className="absolute inset-0 p-3 flex flex-col justify-between">
                        <div className="text-[10px] text-white/90 font-semibold">Segment {index + 1}</div>
                        <div className="text-[9px] text-white/70">{clip.duration}s</div>
                      </div>
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition rounded-lg"></div>
                    </div>
                  ))}
                </div>

                <div 
                  className="absolute top-0 bottom-0 w-1 bg-red-500 z-10 cursor-ew-resize shadow-lg"
                  style={{ left: `${(playheadPosition / 120) * 100}%` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full">
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-transparent border-t-red-500"></div>
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full -mt-6 bg-red-500 text-white text-[10px] font-mono px-2 py-1 rounded whitespace-nowrap">
                    00:42:15
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="text-xs text-zinc-500 mb-2 font-medium flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
                  <Volume2 className="w-3 h-3 text-blue-400" />
                </div>
                Audio Track
              </div>
              <div className="h-20 bg-zinc-900 rounded-xl border border-zinc-800 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-2">
                  {Array.from({ length: 80 }).map((_, i) => (
                    <div 
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full opacity-60"
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-72 bg-zinc-900 border-l border-zinc-800 p-4 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="text-sm font-semibold mb-4">Clip Properties</div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">Start Time</label>
                  <input 
                    type="text" 
                    defaultValue="00:00:00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">Duration</label>
                  <input 
                    type="text" 
                    defaultValue="00:35:00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">Volume</label>
                  <input type="range" className="w-full" defaultValue="80" />
                  <div className="flex justify-between text-xs text-zinc-600 mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <div className="text-sm font-semibold mb-3">Project Info</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Duration</span>
                  <span className="font-mono">2:34:15</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Segments</span>
                  <span>3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Size</span>
                  <span>~2.1 GB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUploadPage = () => {
    const isRendering = renderProgress < 100;
    const isUploading = renderProgress === 100 && uploadProgress < 100;
    const isComplete = renderProgress === 100 && uploadProgress === 100;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-12">
            {isRendering && (
              <>
                <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h1 className="text-3xl font-bold mb-2">Rendering Your Video</h1>
                <p className="text-zinc-400">This usually takes 2-3 minutes...</p>
              </>
            )}
            {isUploading && (
              <>
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Upload className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Uploading to Platforms</h1>
                <p className="text-zinc-400">Publishing to your connected accounts...</p>
              </>
            )}
            {isComplete && (
              <>
                <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Upload Complete! 🎉</h1>
                <p className="text-zinc-400">Your video is now live on all platforms</p>
              </>
            )}
          </div>

          {isRendering && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Rendering Video</span>
                <span className="text-sm text-purple-400 font-mono">{renderProgress}%</span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${renderProgress}%` }}
                ></div>
              </div>
              <div className="mt-4 text-xs text-zinc-500">
                Processing with FFmpeg • 1080p @ 30fps
              </div>
            </div>
          )}

          {(isUploading || isComplete) && (
            <div className="space-y-4 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <Youtube className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">YouTube</div>
                    <div className="text-xs text-zinc-500">YourChannel</div>
                  </div>
                  {isComplete && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      Live
                    </div>
                  )}
                </div>
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-500 to-red-400"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {isComplete && (
                  <button className="text-sm text-blue-400 hover:text-blue-300 underline">
                    View on YouTube →
                  </button>
                )}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Facebook className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">Facebook</div>
                    <div className="text-xs text-zinc-500">Your Page</div>
                  </div>
                  {isComplete && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      Live
                    </div>
                  )}
                </div>
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Uploading...</span>
                      <span>{Math.max(0, uploadProgress - 10)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                        style={{ width: `${Math.max(0, uploadProgress - 10)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {isComplete && (
                  <button className="text-sm text-blue-400 hover:text-blue-300 underline">
                    View on Facebook →
                  </button>
                )}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 opacity-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                    <Twitter className="w-6 h-6 text-cyan-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">Twitter / X</div>
                    <div className="text-xs text-zinc-500">Not connected</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isComplete && (
            <div className="flex gap-4">
              <button 
                onClick={() => setCurrentView('post-stream')}
                className="flex-1 px-6 py-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition font-semibold"
              >
                Back to Home
              </button>
              <button className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition font-semibold">
                Share Links
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {currentView === 'post-stream' && renderPostStreamPage()}
      {currentView === 'editor' && renderEditorPage()}
      {currentView === 'render' && renderUploadPage()}
    </div>
  );
};

export default PostStreamFlow;