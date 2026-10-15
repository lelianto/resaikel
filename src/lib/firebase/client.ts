'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { emulatorConfig, firebaseClientConfig, isEmulatorMode } from '@/lib/config';

/**
 * Firebase client SDK singleton.
 *
 * In emulator mode the SDKs are connected to the local suite. Connecting twice
 * throws, so the emulator wiring is guarded by a module-level flag rather than
 * being repeated on every render.
 */

let app: FirebaseApp | null = null;
let emulatorsConnected = false;

function firebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseClientConfig);
  return app;
}

export function firebaseAuth(): Auth {
  const auth = getAuth(firebaseApp());
  if (isEmulatorMode && !emulatorsConnected) {
    emulatorsConnected = true;
    connectAuthEmulator(auth, `http://${emulatorConfig.authHost}:${emulatorConfig.authPort}`, {
      disableWarnings: true,
    });
  }
  return auth;
}

export function firestore(): Firestore {
  const db = getFirestore(firebaseApp());
  if (isEmulatorMode && !emulatorsConnected) {
    emulatorsConnected = true;
    connectFirestoreEmulator(db, emulatorConfig.firestoreHost, emulatorConfig.firestorePort);
  }
  return db;
}

export function cloudStorage(): FirebaseStorage {
  const storage = getStorage(firebaseApp());
  if (isEmulatorMode && !emulatorsConnected) {
    emulatorsConnected = true;
    connectStorageEmulator(storage, emulatorConfig.storageHost, emulatorConfig.storagePort);
  }
  return storage;
}
