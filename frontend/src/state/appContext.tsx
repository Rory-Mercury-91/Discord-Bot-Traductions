import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';

export type VarConfig = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'select';
  options?: string[];
  fullWidth?: boolean;
  hasSaveLoad?: boolean;
  showInAvailableVars?: boolean;
  domId?: string;
  templates?: string[]; // Liste des IDs de templates associés (vide = tous)
  isCustom?: boolean; // Pour distinguer les variables par défaut des personnalisées
};

export type Template = {
  id?: string;
  name: string;
  type?: string | null;
  content: string;
};

export type Tag = { name: string; id?: string; template?: string };

export type PublishedPost = {
  id: string;              // UUID local
  timestamp: number;       // Date publication
  title: string;           // Titre du post
  content: string;         // Contenu complet
  tags: string;            // Tags CSV
  template: string;        // "my" ou "partner"
  imagePath?: string;      // Chemin image locale (si utilisée)
  
  // Données Discord (reçues après publication)
  threadId: string;        // ID du thread forum
  messageId: string;       // ID du premier message
  discordUrl: string;      // https://discord.com/channels/...
  forumId: number;         // FORUM_MY_ID ou FORUM_PARTNER_ID
};

const defaultVarsConfig: VarConfig[] = [
  {name: 'Name_game', label: 'Nom du jeu', placeholder: 'Lost Solace'},
  {name: 'Game_version', label: 'Version du jeu', placeholder: 'v0.1'},
  {name: 'Translate_version', label: 'Version de la traduction', placeholder: 'v0.1'},
  {name: 'Game_link', label: 'Lien du jeu', placeholder: 'https://...'},
  {name: 'Translate_link', label: 'Lien de la traduction', placeholder: 'https://...'},
  {name: 'traductor', label: 'Traducteur', placeholder: 'Rory Mercury 91', hasSaveLoad: true},
  {name: 'overview', label: 'Synopsis', placeholder: 'Synopsis du jeu...', type: 'textarea'}
];

const defaultTemplates: Template[] = [
  {
    id: 'mes',
    name: 'Mes traductions',
    type: 'my',
    content: `## :flag_fr: [game_name] est disponible en français ! :tada:

Salut l'équipe ! Le patch est enfin prêt, vous pouvez l'installer dès maintenant pour profiter du titre dans notre langue. Bon jeu à tous ! :point_down:

### :computer: Infos du Mod & Liens de Téléchargement
* **Titre du jeu :** [game_name]
* **Version du jeu :** [game_version]
* **Version traduite :** [translate_version]
* **Lien du jeu (VO) :** [Accès au jeu original]([game_link])
* **Lien de la Traduction :** [Téléchargez la traduction FR ici !]([translate_link])
> **Synopsis du jeu :**
> [overview]
[instruction]
### :sparkling_heart: Soutenez le Traducteur !
Pour m'encourager et soutenir mes efforts :
* **Soutien au Traducteur (Moi !) :** [Offrez-moi un café pour le temps passé !](https://discord.com/channels/1417811606674477139/1433930090349330493)`
  },
  {
    id: 'partenaire',
    name: 'Traductions partenaire',
    type: 'partner',
    content: `## :flag_fr: [game_name] est disponible en français ! :tada:

Salut l'équipe ! Le patch est enfin prêt, vous pouvez l'installer dès maintenant pour profiter du titre dans notre langue. Bon jeu à tous ! :point_down:

### :computer: Infos du Mod & Liens de Téléchargement
* **Traducteur :** [translator]
* **Titre du jeu :** [game_name]
* **Version du jeu :** [game_version]
* **Version traduite :** [translate_version]
* **Lien du jeu (VO) :** [Accès au jeu original]([game_link])
* **Lien de la Traduction :** [Téléchargez la traduction FR ici !]([translate_link])
> **Synopsis du jeu :**
> [overview]
[instruction]`
  }
];

type AppContextValue = {
  templates: Template[];
  addTemplate: (t: Template) => void;
  updateTemplate: (idx: number, t: Template) => void;
  deleteTemplate: (idx: number) => void;
  currentTemplateIdx: number;
  setCurrentTemplateIdx: (n: number) => void;
  allVarsConfig: VarConfig[];
  addVarConfig: (v: VarConfig) => void;
  updateVarConfig: (idx: number, v: VarConfig) => void;
  deleteVarConfig: (idx: number) => void;
  inputs: Record<string, string>;
  setInput: (name: string, value: string) => void;
  preview: string;
  savedTags: Tag[];
  addSavedTag: (t: Tag) => void;
  deleteSavedTag: (idx: number) => void;

  savedInstructions: Record<string,string>;
  saveInstruction: (name:string, text:string) => void;
  deleteInstruction: (name:string) => void;

  savedTraductors: string[];
  saveTraductor: (name:string) => void;
  deleteTraductor: (idx:number) => void;

  uploadedImages: Array<{id:string,path:string,isMain:boolean}>;
  addImages: (files: FileList | File[]) => void;
  removeImage: (idx:number) => void;
  setMainImage: (idx:number) => void;

  // Post & API
  postTitle: string;
  setPostTitle: (s:string) => void;
  postTags: string;
  setPostTags: (s:string) => void;

  apiUrl: string;
  setApiUrl: (s:string) => void;
  apiKey: string;
  setApiKey: (s:string) => void;

  publishInProgress: boolean;
  lastPublishResult: string | null;
  publishPost: () => Promise<{ok:boolean, data?:any, error?:string}>;

  // History
  publishedPosts: PublishedPost[];
  addPublishedPost: (p: PublishedPost) => void;
  updatePublishedPost: (id: string, p: Partial<PublishedPost>) => void;
  deletePublishedPost: (id: string) => void;

  // Edit mode
  editingPostId: string | null;
  setEditingPostId: (id: string | null) => void;
  loadPostForEditing: (post: PublishedPost) => void;
  loadPostForDuplication: (post: PublishedPost) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({children}: {children: React.ReactNode}){
  const [templates, setTemplates] = useState<Template[]>(() => {
    try{
      const raw = localStorage.getItem('customTemplates');
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return defaultTemplates;
  });

  const [allVarsConfig, setAllVarsConfig] = useState<VarConfig[]>(() => {
    try{
      const raw = localStorage.getItem('customVariables');
      if(raw) {
        const vars = JSON.parse(raw);
        // Migration: supprimer l'ancienne variable install_instructions qui est remplacée par le système d'instructions
        return vars.filter((v: VarConfig) => v.name !== 'install_instructions');
      }
    }catch(e){}
    return defaultVarsConfig;
  });

  const [currentTemplateIdx, setCurrentTemplateIdx] = useState<number>(0);

  const [inputs, setInputs] = useState<Record<string,string>>(() => {
    // load some defaults from localStorage if present
    const obj: Record<string,string> = {};
    allVarsConfig.forEach(v => obj[v.name] = '');
    try{
      const raw = localStorage.getItem('savedInputs');
      if(raw){
        const parsed = JSON.parse(raw);
        Object.assign(obj, parsed);
      }
    }catch(e){}
    return obj;
  });

  const [savedInstructions, setSavedInstructions] = useState<Record<string,string>>(() => {
    try{ const raw = localStorage.getItem('savedInstructions'); if(raw) return JSON.parse(raw); }catch(e){}
    return {};
  });

  const [savedTraductors, setSavedTraductors] = useState<string[]>(() => {
    try{ const raw = localStorage.getItem('savedTraductors'); if(raw) return JSON.parse(raw); }catch(e){}
    return [];
  });

  const [uploadedImages, setUploadedImages] = useState<Array<{id:string,path:string,isMain:boolean}>>(() => {
    try{ 
      const raw = localStorage.getItem('uploadedImages'); 
      if(raw) {
        const parsed = JSON.parse(raw);
        // Migration: convert old dataUrl format to new path format
        if(parsed.length > 0 && parsed[0].dataUrl) {
          return []; // Reset old format images
        }
        return parsed;
      }
    }catch(e){}
    return [];
  });

  const [savedTags, setSavedTags] = useState<Tag[]>(() => {
    try{ const raw = localStorage.getItem('savedTags'); if(raw) return JSON.parse(raw); }catch(e){}
    return [];
  });

  // Post fields and API configuration
  const [postTitle, setPostTitle] = useState<string>(() => {
    try{ const raw = localStorage.getItem('postTitle'); return raw || ''; }catch(e){ return ''; }
  });
  const [postTags, setPostTags] = useState<string>(() => {
    try{ const raw = localStorage.getItem('postTags'); return raw || ''; }catch(e){ return ''; }
  });

  const [apiUrl, setApiUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');

  // Load publisher config from main process if available
  useEffect(()=>{
    try{
      (window as any).electronAPI?.getPublisherConfig?.().then((cfg:any)=>{
        if(cfg){ if(cfg.apiUrl) setApiUrl(cfg.apiUrl); if(cfg.apiKey) setApiKey(cfg.apiKey); }
      }).catch(()=>{});
    }catch(e){}
  },[]);

  const [publishInProgress, setPublishInProgress] = useState<boolean>(false);
  const [lastPublishResult, setLastPublishResult] = useState<string | null>(null);

  // Published posts history
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>(() => {
    try{ 
      const raw = localStorage.getItem('publishedPosts'); 
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return [];
  });

  // Edit mode
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostData, setEditingPostData] = useState<PublishedPost | null>(null);

  useEffect(()=>{ localStorage.setItem('postTitle', postTitle); },[postTitle]);
  useEffect(()=>{ localStorage.setItem('postTags', postTags); },[postTags]);
  useEffect(()=>{
    // persist to main process
    try{ (window as any).electronAPI?.setPublisherConfig?.({ apiUrl, apiKey }); }catch(e){}
  },[apiUrl, apiKey]);

  useEffect(()=>{
    localStorage.setItem('customTemplates', JSON.stringify(templates));
  },[templates]);

  useEffect(()=>{
    localStorage.setItem('publishedPosts', JSON.stringify(publishedPosts));
  },[publishedPosts]);

  // History management functions
  const addPublishedPost = (p: PublishedPost) => {
    setPublishedPosts(prev => [p, ...prev]); // Newest first
  };

  const updatePublishedPost = (id: string, updates: Partial<PublishedPost>) => {
    setPublishedPosts(prev => prev.map(post => post.id === id ? {...post, ...updates} : post));
  };

  const deletePublishedPost = (id: string) => {
    setPublishedPosts(prev => prev.filter(post => post.id !== id));
  };

  async function publishPost(){
    // Build and send a multipart/form-data request to apiUrl
    const title = (postTitle || '').trim(); // Uniquement le champ "Titre du post"
    const content = preview || '';
    const tags = postTags || '';
    const templateType = (templates[currentTemplateIdx]?.type) || '';
    const isEditMode = editingPostId !== null && editingPostData !== null;

    // Validation: titre obligatoire (uniquement postTitle)
    if(!title || title.length === 0){ 
      setLastPublishResult('❌ Titre obligatoire'); 
      return {ok:false, error:'missing_title'}; 
    }
    
    // Validation: API endpoint requis
    if(!apiUrl || apiUrl.trim().length === 0){ 
      setLastPublishResult('❌ Endpoint API manquant'); 
      return {ok:false, error:'missing_api_url'}; 
    }
    
    // Validation: template type obligatoire (my/partner uniquement)
    if(templateType !== 'my' && templateType !== 'partner') {
      setLastPublishResult('❌ Seuls les templates "Mes traductions" et "Traductions partenaire" peuvent être publiés');
      return {ok:false, error:'invalid_template_type'};
    }

    setPublishInProgress(true);
    setLastPublishResult(null);

    try{
      // Delegate to main process for security (keeps apiKey out of renderer)
      const mainPayload: any = { title, content, tags, template: templateType };
      
      // Add edit mode info if updating
      if(isEditMode) {
        mainPayload.threadId = editingPostData.threadId;
        mainPayload.messageId = editingPostData.messageId;
        mainPayload.isUpdate = true;
      }
      
      // Process all images (not just main image)
      if(uploadedImages.length > 0) {
        const images = [];
        for(const img of uploadedImages) {
          if(!img.path) continue;
          try {
            // Read image from filesystem
            const imgResult = await (window as any).electronAPI?.readImage?.(img.path);
            if(imgResult?.ok && imgResult.buffer) {
              // Convert array back to Uint8Array then to base64
              const buffer = new Uint8Array(imgResult.buffer);
              const base64 = btoa(String.fromCharCode(...buffer));
              const ext = (img.path.split('.').pop() || 'png').toLowerCase();
              // Support for all modern image formats
              const mimeTypes: Record<string, string> = {
                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'png': 'image/png', 'gif': 'image/gif',
                'webp': 'image/webp', 'avif': 'image/avif',
                'bmp': 'image/bmp', 'svg': 'image/svg+xml',
                'ico': 'image/x-icon', 'tiff': 'image/tiff', 'tif': 'image/tiff'
              };
              const mimeType = mimeTypes[ext] || 'image/' + ext;
              images.push({
                dataUrl: `data:${mimeType};base64,${base64}`,
                filename: img.path.split('_').slice(2).join('_'), // Remove timestamp prefix
                isMain: img.isMain
              });
            }
          } catch(e) {
            console.error('Failed to read image:', img.path, e);
          }
        }
        if(images.length > 0) {
          mainPayload.images = images;
        }
      }

      const res = await (window as any).electronAPI?.publishPost?.(mainPayload);
      if(!res){ setLastPublishResult('Erreur interne'); return {ok:false, error:'internal'}; }
      if(!res.ok){ setLastPublishResult('Erreur API: '+(res.error||'unknown')); return {ok:false, error:res.error}; }
      setLastPublishResult(isEditMode ? 'Mise à jour réussie' : 'Publication réussie');
      
      // Save to history or update existing post
      if(res.data && res.data.thread_id && res.data.message_id) {
        if(isEditMode && editingPostId) {
          // Update existing post in history
          const updatedPost: Partial<PublishedPost> = {
            timestamp: Date.now(), // Update timestamp
            title,
            content,
            tags,
            template: templateType,
            imagePath: uploadedImages.find(i=>i.isMain)?.path,
            discordUrl: res.data.thread_url || res.data.url || editingPostData.discordUrl
          };
          updatePublishedPost(editingPostId, updatedPost);
          
          // Clear edit mode
          setEditingPostId(null);
          setEditingPostData(null);
        } else {
          // Add new post to history
          const newPost: PublishedPost = {
            id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            title,
            content,
            tags,
            template: templateType,
            imagePath: uploadedImages.find(i=>i.isMain)?.path,
            threadId: res.data.thread_id,
            messageId: res.data.message_id,
            discordUrl: res.data.thread_url || res.data.url || '',
            forumId: res.data.forum_id || 0
          };
          addPublishedPost(newPost);
        }
      }
      
      return {ok:true, data: res.data};
    }catch(e:any){
      setLastPublishResult('Erreur envoi: '+String(e?.message || e));
      return {ok:false, error: String(e?.message || e)};
    }finally{
      setPublishInProgress(false);
    }
  }


  useEffect(()=>{
    localStorage.setItem('customVariables', JSON.stringify(allVarsConfig));
  },[allVarsConfig]);

  useEffect(()=>{
    localStorage.setItem('savedTags', JSON.stringify(savedTags));
  },[savedTags]);

  useEffect(()=>{
    localStorage.setItem('savedInputs', JSON.stringify(inputs));
  },[inputs]);

  useEffect(()=>{
    localStorage.setItem('savedInstructions', JSON.stringify(savedInstructions));
  },[savedInstructions]);

  useEffect(()=>{
    localStorage.setItem('savedTraductors', JSON.stringify(savedTraductors));
  },[savedTraductors]);

  useEffect(()=>{
    localStorage.setItem('uploadedImages', JSON.stringify(uploadedImages));
  },[uploadedImages]);

  function addTemplate(t: Template){
    setTemplates(prev => [...prev, t]);
  }
  function updateTemplate(idx:number, t:Template){
    setTemplates(prev => { const copy = [...prev]; copy[idx]=t; return copy; });
  }
  function deleteTemplate(idx:number){
    setTemplates(prev => { const copy = [...prev]; copy.splice(idx,1); return copy; });
    setCurrentTemplateIdx(0);
  }

  function addVarConfig(v: VarConfig){
    setAllVarsConfig(prev => [...prev, {...v, isCustom: true}]);
  }
  function updateVarConfig(idx: number, v: VarConfig){
    setAllVarsConfig(prev => { const copy = [...prev]; copy[idx] = {...v, isCustom: copy[idx].isCustom}; return copy; });
  }
  function deleteVarConfig(idx: number){
    const varName = allVarsConfig[idx]?.name;
    setAllVarsConfig(prev => { const copy = [...prev]; copy.splice(idx, 1); return copy; });
    // Nettoyer l'input associé
    if(varName){
      setInputs(prev => { const copy = {...prev}; delete copy[varName]; return copy; });
    }
  }

  function setInput(name:string, value:string){
    setInputs(prev => ({...prev, [name]: value}));
  }

  function addSavedTag(t:Tag){
    setSavedTags(prev => [...prev, t]);
  }
  function deleteSavedTag(idx:number){
    setSavedTags(prev => { const copy = [...prev]; copy.splice(idx,1); return copy; });
  }

  // Instructions saved
  function saveInstruction(name:string, text:string){
    setSavedInstructions(prev => ({...prev, [name]: text}));
  }
  function deleteInstruction(name:string){
    setSavedInstructions(prev => { const copy = {...prev}; delete copy[name]; return copy; });
  }

  // Traductors
  function saveTraductor(name:string){
    setSavedTraductors(prev => prev.includes(name) ? prev : [...prev, name]);
  }
  function deleteTraductor(idx:number){
    setSavedTraductors(prev => { const copy = [...prev]; copy.splice(idx,1); return copy; });
  }

  // Images
  async function addImages(files: FileList | File[]){
    const fileArray = Array.from(files as any) as File[];
    for(const file of fileArray) {
      if(!file.type.startsWith('image/')) continue;
      try {
        // Save image to filesystem via IPC
        const result = await (window as any).electronAPI?.saveImage?.((file as any).path);
        if(result?.ok && result.fileName) {
          setUploadedImages(prev => {
            const next = [...prev, {id: Date.now().toString(), path: result.fileName, isMain: prev.length===0}];
            return next;
          });
        }
      } catch(e) {
        console.error('Failed to save image:', e);
      }
    }
  }

  async function removeImage(idx:number){
    const img = uploadedImages[idx];
    if(img?.path) {
      try {
        // Delete image file from filesystem
        await (window as any).electronAPI?.deleteImage?.(img.path);
      } catch(e) {
        console.error('Failed to delete image:', e);
      }
    }
    setUploadedImages(prev => { const copy = [...prev]; copy.splice(idx,1); if(copy.length && !copy.some(i=>i.isMain)) copy[0].isMain = true; return copy; });
  }

  function setMainImage(idx:number){
    setUploadedImages(prev => prev.map((i,s) => ({...i, isMain: s===idx})));
  }

  const preview = useMemo(()=>{
    const tpl = templates[currentTemplateIdx];
    if(!tpl) return '';
    const format = (tpl as any).format || 'markdown';

    let content = tpl.content;

    // Replace variables
    allVarsConfig.forEach(varConfig => {
      const name = varConfig.name;
      const val = (inputs[name] || '').trim();
      let finalVal = val;
      if(format === 'markdown' && name === 'overview' && val){
        const lines = val.split('\n').map(l=>l.trim()).filter(Boolean);
        finalVal = lines.join('\n> ');
        
        // Inject instructions right after overview if present
        const instructionContent = (inputs['instruction'] || '').trim();
        if(instructionContent) {
          finalVal += '\n\n**Instructions d\'installation :**\n' + instructionContent.split('\n').map(l => l.trim()).filter(Boolean).map(l => '* ' + l).join('\n');
        }
      }
      content = content.split('['+name+']').join(finalVal || '['+name+']');
    });

    // Remove [instruction] placeholder if not already replaced within overview
    content = content.split('[instruction]').join('');

    return content;
  }, [templates, currentTemplateIdx, allVarsConfig, inputs]);

  const value: AppContextValue = {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    currentTemplateIdx,
    setCurrentTemplateIdx,
    allVarsConfig,
    addVarConfig,
    updateVarConfig,
    deleteVarConfig,
    inputs,
    setInput,
    preview,
    savedTags,
    addSavedTag,
    deleteSavedTag,

    savedInstructions,
    saveInstruction,
    deleteInstruction,

    savedTraductors,
    saveTraductor,
    deleteTraductor,

    uploadedImages,
    addImages,
    removeImage,
    setMainImage,

    // Post & API
    postTitle,
    setPostTitle,
    postTags,
    setPostTags,

    apiUrl,
    setApiUrl,
    apiKey,
    setApiKey,

    publishInProgress,
    lastPublishResult,
    publishPost,

    // History
    publishedPosts,
    addPublishedPost,
    updatePublishedPost,
    deletePublishedPost,

    // Edit mode
    editingPostId,
    setEditingPostId,
    loadPostForEditing: (post: PublishedPost) => {
      // Load post data into editor for updating
      setEditingPostId(post.id);
      setEditingPostData(post); // Store original post data
      setPostTitle(post.title);
      setPostTags(post.tags);
      
      // Find and set template
      const templateIdx = templates.findIndex(t => t.type === post.template);
      if(templateIdx !== -1) setCurrentTemplateIdx(templateIdx);
      
      // Parse content to extract variables (basic extraction, may need refinement)
      // For now, we'll just leave inputs as is since content is already generated
      // User will need to manually adjust if needed
    },
    loadPostForDuplication: (post: PublishedPost) => {
      // Load post data but clear editing mode (creates new post)
      setEditingPostId(null);
      setEditingPostData(null);
      setPostTitle(post.title);
      setPostTags(post.tags);
      
      // Find and set template
      const templateIdx = templates.findIndex(t => t.type === post.template);
      if(templateIdx !== -1) setCurrentTemplateIdx(templateIdx);
    }
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(){
  const ctx = useContext(AppContext);
  if(!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
