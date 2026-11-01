// Coach dashboard entry point.
import { mountAdmin, start } from './shell.js';
import './overview.js';
import './leads.js';
import './clients.js';
import './checkins.js';
import './content.js';
import './system.js';

const ctx = await mountAdmin();
if (ctx) start();
