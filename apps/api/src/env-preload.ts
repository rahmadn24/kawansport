/**
 * Muat .env SEBELUM module lain dievaluasi (SEC-01 fail-closed melempar
 * saat import bila env hilang). Import file ini PALING ATAS di main.ts
 * dan seed.ts. Urutan path mengikuti ConfigModule: cwd dulu, lalu root.
 * Variabel yg sudah ada di shell tidak ditimpa (perilaku default dotenv).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
