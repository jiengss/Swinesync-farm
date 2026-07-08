import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://smztesmqtbxesdzysntt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtenRlc21xdGJ4ZXNkenlzbnR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjIzMzMsImV4cCI6MjA5NzY5ODMzM30.m0y0IeiLN-WIoKffV4cjfYDzyt_GOExnMh8GNJPGdbQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)