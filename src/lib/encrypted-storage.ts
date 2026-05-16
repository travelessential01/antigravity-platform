export const DB_NAME = 'stayassist-crypto';
export const KEY_STORE = 'keys';
export const DATA_STORE = 'jwt_cache';

async function getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // Guard: IndexedDB is browser-only. Reject immediately during SSR.
        if (typeof window === 'undefined' || !window.indexedDB) {
            return reject(new Error('IndexedDB is not available in this environment'));
        }
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(KEY_STORE);
            request.result.createObjectStore(DATA_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getOrGenerateKey(): Promise<CryptoKey> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(KEY_STORE, 'readwrite');
        const store = tx.objectStore(KEY_STORE);
        const getReq = store.get('aes-gcm-jwt-key');

        getReq.onsuccess = async () => {
            if (getReq.result) {
                resolve(getReq.result as CryptoKey);
            } else {
                const key = await window.crypto.subtle.generateKey(
                    { name: 'AES-GCM', length: 256 },
                    false, // extractable = false (critical for HIPAA/DPDP security)
                    ['encrypt', 'decrypt']
                );
                store.put(key, 'aes-gcm-jwt-key').onsuccess = () => resolve(key);
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

/**
 * Custom Storage Adapter mandated by Task 2.2 for Supabase GoTrue caching.
 * Encrypts the JWT string using AES-256-GCM before writing to IndexedDB.
 */
export const encryptedIndexedDBStorage = {
    async getItem(key: string): Promise<string | null> {
        if (typeof window === 'undefined') return null;

        const db = await getDb();
        return new Promise((resolve) => {
            const tx = db.transaction(DATA_STORE, 'readonly');
            const store = tx.objectStore(DATA_STORE);
            const getReq = store.get(key);

            getReq.onsuccess = async () => {
                if (!getReq.result) return resolve(null);
                try {
                    const cryptoKey = await getOrGenerateKey();
                    const { iv, ciphertext } = getReq.result;

                    const decrypted = await window.crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: new Uint8Array(iv) },
                        cryptoKey,
                        new Uint8Array(ciphertext)
                    );
                    resolve(new TextDecoder().decode(decrypted));
                } catch (e) {
                    console.error('[encrypted-storage] Decryption failed:', e);
                    resolve(null);
                }
            };
            getReq.onerror = () => resolve(null);
        });
    },

    async setItem(key: string, value: string): Promise<void> {
        if (typeof window === 'undefined') return;

        try {
            const cryptoKey = await getOrGenerateKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(value);

            const ciphertext = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                cryptoKey,
                encoded
            );

            const db = await getDb();
            return new Promise<void>((resolve, reject) => {
                const tx = db.transaction(DATA_STORE, 'readwrite');
                const store = tx.objectStore(DATA_STORE);
                // Store as ArrayBuffers in IndexedDB
                store.put({
                    iv: Array.from(iv),
                    ciphertext: Array.from(new Uint8Array(ciphertext))
                }, key).onsuccess = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.error('[encrypted-storage] Encryption failed:', e);
        }
    },

    async removeItem(key: string): Promise<void> {
        if (typeof window === 'undefined') return;

        const db = await getDb();
        return new Promise((resolve) => {
            const tx = db.transaction(DATA_STORE, 'readwrite');
            const store = tx.objectStore(DATA_STORE);
            store.delete(key).onsuccess = () => resolve();
        });
    }
};
