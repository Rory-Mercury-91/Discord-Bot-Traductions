import React from 'react';
import PreviewImage from './PreviewImage';

interface PreviewProps {
  preview: string;
  previewMode: 'raw' | 'styled';
  setPreviewMode: (mode: 'raw' | 'styled') => void;
  onCopy: () => void;
  onReset: () => void;
  mainImagePath?: string;
}

// Map des émojis Discord courants (format :nom: → Unicode)
const discordEmojis: Record<string, string> = {
  // Smileys et émotions
  'smile': '😄', 'grinning': '😀', 'smiley': '😃', 'grin': '😁', 'laughing': '😆', 'satisfied': '😆',
  'joy': '😂', 'rofl': '🤣', 'relaxed': '☺️', 'blush': '😊', 'innocent': '😇', 'wink': '😉',
  'heart_eyes': '😍', 'kissing_heart': '😘', 'kissing': '😗', 'yum': '😋', 'stuck_out_tongue': '😛',
  'stuck_out_tongue_winking_eye': '😜', 'stuck_out_tongue_closed_eyes': '😝', 'thinking': '🤔',
  'neutral_face': '😐', 'expressionless': '😑', 'no_mouth': '😶', 'smirk': '😏', 'unamused': '😒',
  'roll_eyes': '🙄', 'grimacing': '😬', 'lying_face': '🤥', 'relieved': '😌', 'pensive': '😔',
  'sleepy': '😪', 'drooling_face': '🤤', 'sleeping': '😴', 'mask': '😷', 'face_with_thermometer': '🤒',
  'face_with_head_bandage': '🤕', 'nauseated_face': '🤢', 'sneezing_face': '🤧', 'dizzy_face': '😵',
  'cowboy': '🤠', 'sunglasses': '😎', 'nerd': '🤓', 'confused': '😕', 'worried': '😟',
  'slightly_frowning_face': '🙁', 'frowning': '☹️', 'persevere': '😣', 'confounded': '😖',
  'tired_face': '😫', 'weary': '😩', 'triumph': '😤', 'angry': '😠', 'rage': '😡',
  'sob': '😭', 'disappointed': '😞', 'sweat': '😓', 'cry': '😢', 'fearful': '😨',
  'scream': '😱', 'flushed': '😳', 'disappointed_relieved': '😥', 'astonished': '😲',
  'zipper_mouth': '🤐', 'hushed': '😯', 'exploding_head': '🤯', 'wave': '👋', 'raised_hand': '✋',
  
  // Gestes et mains
  'ok_hand': '👌', 'thumbsup': '👍', '+1': '👍', 'thumbsdown': '👎', '-1': '👎', 'punch': '👊',
  'fist': '✊', 'left_facing_fist': '🤛', 'right_facing_fist': '🤜', 'v': '✌️', 'crossed_fingers': '🤞',
  'metal': '🤘', 'call_me': '🤙', 'point_left': '👈', 'point_right': '👉', 'point_up_2': '👆',
  'point_down': '👇', 'point_up': '☝️', 'raised_hands': '🙌', 'pray': '🙏', 'clap': '👏',
  'muscle': '💪', 'writing_hand': '✍️',
  
  // Cœurs et symboles
  'heart': '❤️', 'orange_heart': '🧡', 'yellow_heart': '💛', 'green_heart': '💚', 'blue_heart': '💙',
  'purple_heart': '💜', 'black_heart': '🖤', 'white_heart': '🤍', 'brown_heart': '🤎', 'broken_heart': '💔',
  'heart_exclamation': '❣️', 'two_hearts': '💕', 'revolving_hearts': '💞', 'heartbeat': '💓',
  'heartpulse': '💗', 'sparkling_heart': '💖', 'cupid': '💘', 'gift_heart': '💝', 'kiss': '💋',
  'star2': '🌟', 'dizzy': '💫', 'sparkles': '✨', 'boom': '💥',
  'zap': '⚡', 'zzz': '💤', 'sweat_drops': '💦', 'dash': '💨',
  
  // Animaux et nature
  'dog': '🐶', 'cat': '🐱', 'mouse': '🐭', 'rabbit': '🐰', 'fox': '🦊', 'bear': '🐻',
  'panda_face': '🐼', 'koala': '🐨', 'tiger': '🐯', 'lion': '🦁', 'cow': '🐮', 'pig': '🐷',
  'frog': '🐸', 'monkey_face': '🐵', 'see_no_evil': '🙈', 'hear_no_evil': '🙉', 'speak_no_evil': '🙊',
  'chicken': '🐔', 'penguin': '🐧', 'bird': '🐦', 'hatching_chick': '🐣', 'baby_chick': '🐤',
  'bee': '🐝', 'bug': '🐛', 'butterfly': '🦋', 'snail': '🐌', 'shell': '🐚', 'turtle': '🐢',
  'snake': '🐍', 'dragon': '🐉', 'whale': '🐋', 'dolphin': '🐬', 'fish': '🐟', 'octopus': '🐙',
};

function renderStyledPreview(text: string): string {
  let html = text;
  
  // Convertir les émojis Discord :nom: en Unicode
  html = html.replace(/:([a-zA-Z0-9_+-]+):/g, (match, emojiName) => {
    return discordEmojis[emojiName] || match;
  });
  
  // Convertir BBCode en HTML
  // [b]...[/b] → <strong>...</strong>
  html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
  // [i]...[/i] → <em>...</em>
  html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
  // [u]...[/u] → <u>...</u>
  html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
  // [s]...[/s] → <s>...</s>
  html = html.replace(/\[s\](.*?)\[\/s\]/gi, '<s>$1</s>');
  // [code]...[/code] → <code>...</code>
  html = html.replace(/\[code\](.*?)\[\/code\]/gi, '<code style="background:rgba(0,0,0,0.3);padding:2px 4px;border-radius:3px;">$1</code>');
  // [url=...]...[/url] → <a>...</a>
  html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" style="color:var(--accent);text-decoration:underline;">$2</a>');
  // [url]...[/url] → <a>...</a>
  html = html.replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" style="color:var(--accent);text-decoration:underline;">$1</a>');
  // [color=...]...[/color] → <span>...</span>
  html = html.replace(/\[color=(.*?)\](.*?)\[\/color\]/gi, '<span style="color:$1;">$2</span>');
  // [size=...]...[/size] → <span>...</span>
  html = html.replace(/\[size=(.*?)\](.*?)\[\/size\]/gi, '<span style="font-size:$1px;">$2</span>');
  // [img]...[/img] → <img>
  html = html.replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" style="max-width:100%;height:auto;border-radius:4px;margin:8px 0;" />');
  // [quote]...[/quote] → <blockquote>...</blockquote>
  html = html.replace(/\[quote\](.*?)\[\/quote\]/gi, '<blockquote style="border-left:3px solid var(--accent);padding-left:12px;margin:8px 0;color:var(--muted);">$1</blockquote>');
  
  // Convertir Markdown basique en HTML (sans bibliothèque externe pour éviter les problèmes)
  // **gras** ou __gras__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  // *italique* ou _italique_
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  // `code`
  html = html.replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.3);padding:2px 4px;border-radius:3px;">$1</code>');
  // [lien](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);text-decoration:underline;">$1</a>');
  // # Titres - espacements très compacts comme Discord, ### = taille normale
  html = html.replace(/^### (.*$)/gim, '<h3 style="margin:8px 0 -4px;font-size:16px;font-weight:600;line-height:1.2;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="margin:8px 0 -6px;font-size:20px;font-weight:600;line-height:1.2;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="margin:8px 0 -4px;font-size:24px;font-weight:600;line-height:1.2;">$1</h1>');
  
  // > citations - regrouper les lignes consécutives
  html = html.replace(/(^> .*$(\n^> .*$)*)/gim, (match) => {
    const lines = match.split('\n').map(line => line.replace(/^> /, '')).join('<br>');
    return `<blockquote style="border-left:3px solid var(--accent);padding-left:12px;margin:8px 0;color:var(--muted);">${lines}</blockquote>`;
  });
  
  // Sauts de ligne
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

export default function Preview({ 
  preview, 
  previewMode, 
  setPreviewMode, 
  onCopy, 
  onReset,
  mainImagePath 
}: PreviewProps) {
  return (
    <div className="preview-container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        {/* Gauche : Preview + toggles Brut/Stylisé */}
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <h5 style={{margin:0}}>👁️ Preview</h5>
          <div style={{display:'flex', gap:4, background:'var(--bg)', borderRadius:6, padding:2}}>
            <button 
              onClick={()=>setPreviewMode('raw')}
              style={{
                padding:'6px 12px',
                background: previewMode === 'raw' ? 'var(--accent)' : 'transparent',
                color: previewMode === 'raw' ? 'white' : 'var(--muted)',
                border:'none',
                borderRadius:4,
                cursor:'pointer',
                fontSize:13,
                height:32
              }}
            >
              📝 Brut
            </button>
            <button 
              onClick={()=>setPreviewMode('styled')}
              style={{
                padding:'6px 12px',
                background: previewMode === 'styled' ? 'var(--accent)' : 'transparent',
                color: previewMode === 'styled' ? 'white' : 'var(--muted)',
                border:'none',
                borderRadius:4,
                cursor:'pointer',
                fontSize:13,
                height:32
              }}
            >
              🎨 Stylisé
            </button>
          </div>
        </div>

        {/* Droite : Copier + Réinitialiser */}
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button 
            onClick={onCopy}
            style={{
              padding:'6px 12px',
              fontSize:13,
              height:32,
              border:'1px solid var(--border)',
              borderRadius:4,
              cursor:'pointer'
            }}
          >
            📋 Copier
          </button>
          <button 
            onClick={onReset}
            style={{
              background:'var(--error)', 
              color:'white',
              padding:'6px 12px',
              fontSize:13,
              height:32,
              border:'none',
              borderRadius:4,
              cursor:'pointer'
            }}
          >
            🔄 Réinitialiser
          </button>
        </div>
      </div>
      {previewMode === 'raw' ? (
        <textarea readOnly rows={18} value={preview} style={{width:'100%', fontFamily:'monospace'}} />
      ) : (
        <div 
          style={{
            width:'100%',
            minHeight:'450px',
            border:'1px solid var(--border)',
            borderRadius:6,
            padding:12,
            background:'var(--panel)',
            overflow:'auto',
            fontFamily:'system-ui, -apple-system, sans-serif'
          }}
        >
          <div dangerouslySetInnerHTML={{__html: renderStyledPreview(preview)}} />
          {mainImagePath && <PreviewImage imagePath={mainImagePath} />}
        </div>
      )}
    </div>
  );
}
