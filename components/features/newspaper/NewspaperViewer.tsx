'use client';

import { useState, useEffect, useRef } from 'react';
import { useE2EEKey } from '@/hooks/use-e2ee-key';
import { supabase } from '@/lib/supabase/client';
import { renderNewspaper, NewspaperData } from '@/lib/newspaper/template';
import { Share, Download, Lock } from 'lucide-react';
import html2canvas from 'html2canvas';

export function NewspaperViewer() {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [archives, setArchives] = useState<any[]>([]);
  
  // 'CURRENT' means we are looking at the new edition tab
  const [selectedArchive, setSelectedArchive] = useState<string>('CURRENT'); 
  const [errorState, setErrorState] = useState<string | null>(null);
  
  const { encrypt, decrypt, key, isLoaded } = useE2EEKey();
  const newspaperRef = useRef<HTMLDivElement>(null);

  // Time logic
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday
  const hour = today.getHours();
  const isPrintingWindow = day === 0 && hour >= 8;

  // Load archives list
  useEffect(() => {
    const fetchArchives = async () => {
      const { data } = await supabase
        .from('newspaper_archives')
        .select('id, published_date, encrypted_html_snapshot')
        .order('published_date', { ascending: false });
      
      if (data) {
        setArchives(data);
        // If it's not the printing window and we have archives, default to the latest archive
        if (!isPrintingWindow && data.length > 0) {
          setSelectedArchive(data[0].published_date);
        }
      }
    };
    fetchArchives();
  }, []); // Only run once on mount, removing supabase from dep array avoids loops

  // Load selected content
  useEffect(() => {
    const loadContent = async () => {
      if (!isLoaded || !key) return;
      
      setLoading(true);
      setHtml(null);
      setErrorState(null);

      if (selectedArchive !== 'CURRENT') {
        // Load from archive
        const archive = archives.find(a => a.published_date === selectedArchive);
        if (archive && archive.encrypted_html_snapshot) {
          try {
            const decryptedHtml = await decrypt(archive.encrypted_html_snapshot);
            setHtml(decryptedHtml);
          } catch (e) {
            console.error(e);
            setErrorState("Failed to decrypt this archive. The key may have changed.");
          }
        }
      } else {
        if (!isPrintingWindow) {
          // It's the Current Edition tab, but we are not in the printing window.
          // The UI will handle displaying the lock screen.
          setHtml(null);
          setLoading(false);
          return;
        }

        // --- GENERATE LIVE EDITION ---
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(today.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        const publishDateStr = new Date().toISOString().split('T')[0];

        try {
          const res = await fetch('/api/newspaper/current');
          if (!res.ok) throw new Error('Failed to fetch current stats');
          
          const rawData = await res.json();
          let { names, editionNumber, stats, qa, dictWord, watchTitle, weekStart: resWeekStart } = rawData;

          // Decrypt Q&A
          if (qa) {
            try {
              qa.answerA = await decrypt(qa.answerA);
              qa.answerB = await decrypt(qa.answerB);
            } catch (e) {
              console.error("Failed to decrypt Q&A", e);
              qa = null;
            }
          }

          // Decrypt Dictionary Word
          if (dictWord) {
            try {
              dictWord.word = await decrypt(dictWord.word);
              dictWord.meaning = await decrypt(dictWord.meaning);
            } catch (e) {
              console.error("Failed to decrypt Dictionary Word", e);
              dictWord = null;
            }
          }

          const data: NewspaperData = {
            names, editionNumber, stats, qa, dictWord, watchTitle, weekStart: resWeekStart
          };

          const generatedHtml = renderNewspaper(data);
          const hasArchiveThisWeek = archives.some(a => a.published_date >= resWeekStart);

          // Only trigger the "print" if we haven't already archived this week
          if (!hasArchiveThisWeek) {
            const encryptedHtml = await encrypt(generatedHtml);
            
            // POST to backend silently
            fetch('/api/newspaper/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                encryptedHtml,
                publishedDate: publishDateStr,
                stats
              })
            }).then(async (genRes) => {
              if (genRes.ok) {
                setArchives(prev => [{
                  id: 'temp-' + Date.now(),
                  published_date: publishDateStr,
                  encrypted_html_snapshot: encryptedHtml
                }, ...prev]);
              }
            }).catch(e => console.error("Failed to trigger printing process", e));
          }
          
          setHtml(generatedHtml);

        } catch (error) {
          console.error("Failed to fetch live newspaper", error);
          setErrorState("Failed to load the newspaper.");
        }
      }
      setLoading(false);
    };

    loadContent();
  }, [selectedArchive, archives, key, isLoaded, encrypt, decrypt]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'The Ours Times',
          text: 'Check out our relationship newspaper!',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleExportImage = async () => {
    if (!newspaperRef.current) return;
    
    try {
      // Ensure custom serif fonts are fully loaded before canvas draws
      await document.fonts.ready;
      
      const canvas = await html2canvas(newspaperRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fdfbf7', // Match the newspaper paper color
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `ours-times-${selectedArchive === 'CURRENT' ? 'live' : selectedArchive}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export image", err);
      alert("Failed to export image. Please try again.");
    }
  };

  if (!isLoaded) {
    return <div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground">Unlocking archives...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Top Nav / Archives List */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-card p-4 rounded-xl border gap-4">
        <div className="flex gap-2 overflow-x-auto w-full pb-2 sm:pb-0">
          
          {/* Current Edition Button */}
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
              selectedArchive === 'CURRENT'
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md" 
                : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            } ${!isPrintingWindow ? "opacity-80" : "animate-pulse border-primary/50"}`}
            onClick={() => setSelectedArchive('CURRENT')}
          >
            {!isPrintingWindow && <Lock className="w-3 h-3" />}
            {isPrintingWindow ? "Read the Sunday Edition" : "Current Edition"}
          </button>

          {/* Archives */}
          {archives.map(a => (
            <button
              key={a.id}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedArchive === a.published_date
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => setSelectedArchive(a.published_date)}
            >
              {a.published_date}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 shrink-0">
          <button 
            className="p-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors disabled:opacity-50" 
            onClick={handleExportImage}
            disabled={loading || (!html && selectedArchive === 'CURRENT')}
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            className="p-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors disabled:opacity-50" 
            onClick={handleShare}
            disabled={loading || (!html && selectedArchive === 'CURRENT')}
            title="Share Link"
          >
            <Share className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-screen">
        {loading ? (
          <div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground">
            {selectedArchive === 'CURRENT' ? "Printing the Sunday digest..." : "Decrypting the archive..."}
          </div>
        ) : errorState ? (
          <div className="flex h-64 items-center justify-center text-red-500">{errorState}</div>
        ) : selectedArchive === 'CURRENT' && !isPrintingWindow ? (
          <div className="flex flex-col h-64 items-center justify-center text-center space-y-4 border-2 border-dashed rounded-xl bg-card/50">
            <Lock className="w-8 h-8 text-muted-foreground" />
            <h2 className="text-2xl font-serif">The presses are rolling</h2>
            <p className="text-muted-foreground">Next edition drops Sunday at 8:00 AM.</p>
          </div>
        ) : (
          <div 
            ref={newspaperRef}
            dangerouslySetInnerHTML={{ __html: html || '' }} 
            className="newspaper-wrapper bg-white shadow-xl rounded-xl overflow-hidden"
          />
        )}
      </div>
    </div>
  );
}
