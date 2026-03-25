import React, { useEffect, useState } from 'react';
import { getPublicContent } from '../services/firebaseService';
import { PublicContent } from '../types';
import { ShieldCheck, Building2, Newspaper, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

export default function PublicSidebar() {
  const [content, setContent] = useState<PublicContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      const data = await getPublicContent();
      if (data) {
        setContent(data);
      }
      setLoading(false);
    };
    fetchContent();
  }, []);

  if (loading) {
    return (
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-indigo-900 text-white p-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-indigo-800 rounded-2xl mb-6"></div>
          <div className="h-8 bg-indigo-800 rounded w-64 mb-4"></div>
          <div className="h-4 bg-indigo-800 rounded w-96"></div>
        </div>
      </div>
    );
  }

  const companyName = content?.companyName || 'Supervisor Eye';
  const description = content?.description || 'Hierarchical Reporting & Accountability Platform';

  return (
    <div className="hidden lg:flex flex-col w-1/2 bg-indigo-900 text-white overflow-y-auto relative">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
      
      <div className="relative z-10 p-12 flex flex-col min-h-full">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{companyName}</h1>
        </div>

        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-6 leading-tight">{description}</h2>
          
          {content?.activities && content.activities.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2 text-indigo-200">
                <Building2 className="w-5 h-5" />
                Our Activities
              </h3>
              <ul className="grid grid-cols-1 gap-3">
                {content.activities.map((activity, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-indigo-100">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{activity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {content?.news && content.news.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-indigo-200">
              <Newspaper className="w-5 h-5" />
              Latest Updates
            </h3>
            <div className="space-y-4">
              {content.news.slice(0, 3).map((item) => (
                <div key={item.id} className="bg-indigo-800/50 backdrop-blur-sm p-5 rounded-2xl border border-indigo-700/50">
                  <div className="text-xs text-indigo-300 mb-2 font-medium">{new Date(item.date).toLocaleDateString()}</div>
                  <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                  <p className="text-indigo-100/80 text-sm leading-relaxed">{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {content?.gallery && content.gallery.length > 0 && (
          <div className="mt-auto pt-12">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-indigo-200">
              <ImageIcon className="w-5 h-5" />
              Gallery
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {content.gallery.slice(0, 4).map((img) => (
                <div key={img.id} className="relative group overflow-hidden rounded-xl aspect-video bg-indigo-800">
                  <img src={img.url} alt={img.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <p className="text-xs font-medium text-white line-clamp-2">{img.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
