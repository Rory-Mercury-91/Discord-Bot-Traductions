import React from 'react';
import { useImageLoader } from '../hooks/useImageLoader';

interface PreviewImageProps {
  imagePath: string;
}

export default function PreviewImage({ imagePath }: PreviewImageProps) {
  const { imageUrl, isLoading, error } = useImageLoader(imagePath);

  if (isLoading) {
    return (
      <div style={{marginTop:12, textAlign:'center', color:'var(--muted)', fontSize:12}}>
        ⏳ Chargement de l'image...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{marginTop:12, textAlign:'center', color:'var(--error)', fontSize:12}}>
        ❌ Erreur de chargement: {error}
      </div>
    );
  }

  if (!imageUrl) {
    return null;
  }

  return (
    <div style={{marginTop:12}}>
      <img 
        src={imageUrl}
        style={{
          width:'100%',
          maxWidth:'600px',
          height:'auto',
          borderRadius:8,
          display:'block'
        }}
        alt="Image principale"
      />
    </div>
  );
}
