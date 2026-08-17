import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';

let supabase = {
    from: () => ({
        select: () => ({
            eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
                order: () => Promise.resolve({ data: [], error: null })
            }),
            neq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
            })
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({
            eq: () => Promise.resolve({ data: null, error: null })
        }),
        delete: () => ({
            eq: () => Promise.resolve({ data: null, error: null })
        }),
        upsert: () => Promise.resolve({ data: null, error: null })
    }),
    channel: () => ({
        on: function () { return this; },
        subscribe: function () { return this; }
    }),
    removeChannel: () => {}
};

try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
    if (createClient && supabaseUrl) {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                storage: AsyncStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
    }
} catch (e) {
    // @supabase/supabase-js is not installed; app uses Firebase
}

export { supabase };
