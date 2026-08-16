import { db, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where } from './firebase.js';

/**
 * Normalizes phone numbers to standard forms:
 * - formatted: "+919876543210"
 * - raw: "9876543210"
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return { formatted: '', raw: '' };
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  let raw = cleaned;
  if (raw.startsWith('+91')) {
    raw = raw.slice(3);
  } else if (raw.startsWith('+')) {
    raw = raw.slice(1);
  }
  const formatted = raw.length === 10 ? `+91${raw}` : (cleaned.startsWith('+') ? cleaned : `+91${cleaned}`);
  return { formatted, raw };
}

/**
 * Searches Firestore 'users' collection for an existing user with the given phone number.
 */
export async function findUserByPhone(phone) {
  if (!phone) return { exists: false, data: null, id: null };

  const { formatted, raw } = normalizePhoneNumber(phone);

  try {
    const usersRef = collection(db, 'users');

    // Check with formatted phone in phone_number
    if (formatted) {
      const q1 = query(usersRef, where('phone_number', '==', formatted));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        const docSnap = snap1.docs[0];
        return { exists: true, id: docSnap.id, data: docSnap.data(), ref: docSnap.ref };
      }
    }

    // Check with raw phone in phone_number
    if (raw && raw !== formatted) {
      const q2 = query(usersRef, where('phone_number', '==', raw));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        const docSnap = snap2.docs[0];
        return { exists: true, id: docSnap.id, data: docSnap.data(), ref: docSnap.ref };
      }
    }

    // Check with formatted phone in phone field
    if (formatted) {
      const q3 = query(usersRef, where('phone', '==', formatted));
      const snap3 = await getDocs(q3);
      if (!snap3.empty) {
        const docSnap = snap3.docs[0];
        return { exists: true, id: docSnap.id, data: docSnap.data(), ref: docSnap.ref };
      }
    }

    // Check with raw phone in phone field
    if (raw && raw !== formatted) {
      const q4 = query(usersRef, where('phone', '==', raw));
      const snap4 = await getDocs(q4);
      if (!snap4.empty) {
        const docSnap = snap4.docs[0];
        return { exists: true, id: docSnap.id, data: docSnap.data(), ref: docSnap.ref };
      }
    }
  } catch (error) {
    console.error('Error finding user by phone in Firestore:', error);
  }

  return { exists: false, data: null, id: null };
}

/**
 * Finds an existing user record or creates a new one in Firestore.
 * Ensures that multiple logins with the same phone number reuse the exact same record.
 */
export async function getOrCreateUserByPhone(phone, fallbackUid = null) {
  const { formatted } = normalizePhoneNumber(phone);
  const targetPhone = formatted || phone;

  // 1. First check if user document already exists by fallbackUid if provided
  if (fallbackUid) {
    try {
      const userRef = doc(db, 'users', fallbackUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          uid: data.uid || fallbackUid,
          name: data.name && data.name !== 'Patient' ? data.name : '',
          phone: data.phone_number || data.phone || targetPhone,
          email: data.email || '',
          docId: fallbackUid,
          isNew: false
        };
      }
    } catch (e) {
      console.warn('Direct doc lookup by UID failed, checking by phone query:', e);
    }
  }

  // 2. Search by phone number in Firestore
  const existing = await findUserByPhone(targetPhone);
  if (existing.exists) {
    const data = existing.data;
    const existingUid = data.uid || existing.id;
    return {
      uid: existingUid,
      name: data.name && data.name !== 'Patient' ? data.name : '',
      phone: data.phone_number || data.phone || targetPhone,
      email: data.email || '',
      docId: existing.id,
      isNew: false
    };
  }

  // 3. If user does NOT exist, create exactly one new user document
  const newUid = fallbackUid || `user_${Date.now()}`;
  const newUserDoc = {
    uid: newUid,
    phone_number: targetPhone,
    phone: targetPhone,
    name: '', // Name will be collected when the user books an appointment
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'users', newUid), newUserDoc);
  } catch (err) {
    console.error('Error creating new user document in Firestore:', err);
  }

  return {
    uid: newUid,
    name: '',
    phone: targetPhone,
    email: '',
    docId: newUid,
    isNew: true
  };
}

/**
 * Saves or updates the patient name in the existing Firestore user record.
 * Does not create duplicate user records.
 */
export async function saveUserNameToUserRecord(uid, phone, name) {
  if (!name || !name.trim()) return;
  const cleanName = name.trim();

  // Try updating by UID first
  if (uid) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { name: cleanName }, { merge: true });
      return;
    } catch (err) {
      console.warn('Updating user name by UID failed, trying phone search:', err);
    }
  }

  // Fallback to phone lookup if UID update failed or UID not provided
  if (phone) {
    try {
      const existing = await findUserByPhone(phone);
      if (existing.exists && existing.id) {
        const userRef = doc(db, 'users', existing.id);
        await updateDoc(userRef, { name: cleanName });
      }
    } catch (err) {
      console.error('Error saving user name to Firestore record by phone:', err);
    }
  }
}

export default {
  normalizePhoneNumber,
  findUserByPhone,
  getOrCreateUserByPhone,
  saveUserNameToUserRecord
};
