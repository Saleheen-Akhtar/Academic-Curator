const fs = require('fs');
let content = fs.readFileSync('./src/App.tsx', 'utf8');

const oldHooks = `  const [scholarshipsLoaded, setScholarshipsLoaded] = useState(false);

  useEffect(() => {
    fetchDynamicScholarships().then(data => {
      SCHOLARSHIPS = data;
      setScholarshipsLoaded(true);
    }).catch(err => {
      console.error(err);
      setScholarshipsLoaded(true);
    });
  }, []);

  if (!scholarshipsLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState<Page>('landing');
  const [previousPage, setPreviousPage] = useState<Page>('landing');
  const [lang, setLang] = useState<Language>('EN');

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });`;

const newHooks = `  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState<Page>('landing');
  const [previousPage, setPreviousPage] = useState<Page>('landing');
  const [lang, setLang] = useState<Language>('EN');

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [scholarshipsLoaded, setScholarshipsLoaded] = useState(false);

  useEffect(() => {
    fetchDynamicScholarships().then(data => {
      SCHOLARSHIPS = data;
      setScholarshipsLoaded(true);
    }).catch(err => {
      console.error(err);
      setScholarshipsLoaded(true);
    });
  }, []);

  // Return early ONLY AFTER all hooks are declared
  if (!scholarshipsLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }`;

content = content.replace(oldHooks, newHooks);

// However, we also need to move any OTHER hooks before the early return!
fs.writeFileSync('./src/App.tsx', content);
console.log('patched hooks');
