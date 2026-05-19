
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://ugdfudenvvbswguqsggn.supabase.co';
const supabaseKey = 'sb_publishable_v1T-V6iCZi1k418jHGv1fQ_RtgPXSdp';

export const supabase = createClient(supabaseUrl, supabaseKey);
