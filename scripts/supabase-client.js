'use strict';

const SUPABASE_URL = 'https://xeeegszazkdibgctyxud.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZWVnc3phemtkaWJnY3R5eHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDY5MDYsImV4cCI6MjA5NTE4MjkwNn0.dHtm-PPo2YlWA712jNKS3MoVIOOYx6yVpWMNNrgS-cg';

// _sb è il client Supabase globale, usato da auth.js e balance.js
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
