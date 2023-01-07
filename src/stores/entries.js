import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { defineStore } from 'pinia'
import { db, storage } from 'src/firebase'
import { usePromptStore, useUserStore } from 'src/stores'

export const useEntryStore = defineStore('entries', {
  state: () => ({
    _isLoading: false,
    _entries: []
  }),

  getters: {
    getEntriesFromPrompt: () => (promptId) => {
      const promptStore = usePromptStore()
      const prompt = promptStore.getPrompts.find((prompt) => prompt.id === promptId)

      return prompt.entries
    },
    isLoading: (state) => state._isLoading
  },

  actions: {
    async fetchEntryBySlug(slug) {
      const q = query(collection(db, 'entries'), where('slug', '==', slug))
      this._isLoading = true
      const querySnapshot = await getDocs(q)

      const entry = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))[0]

      entry.author = await getDoc(entry.author).then((doc) => doc.data())
      entry.prompt = await getDoc(entry.prompt).then((doc) => doc.data())

      this._isLoading = false

      return entry
    },
    async addEntryToStore(entries){

    },

    async fetchEntries(promptId) {
      const promptStore = usePromptStore()
      const promptRef = promptStore.getPromptRef(promptId)

      const q = query(collection(db, 'entries'), where('prompt', '==', promptRef))

      this._isLoading = true
      const querySnapshot = await getDocs(q)
      try {
        const entries = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

        for (const entry of entries) {
          entry.author = await getDoc(entry.author).then((doc) => doc.data())
          entry.prompt = await getDoc(entry.prompt).then((doc) => doc.data())
        }
      } catch (error) {
        console.error(error)
        throw new Error(error)
      }

      this._isLoading = false
    },

    async addEntry(entry) {
      const promptStore = usePromptStore()
      const userStore = useUserStore()

      const promptId = entry.prompt.value
      const entryRef = doc(db, 'entries', entry.id)

      entry.created = Timestamp.fromDate(new Date())
      entry.prompt = promptStore.getPromptRef(entry.prompt.value)

      const index = promptStore.getPrompts.findIndex((prompt) => prompt.id === promptId)
      const prompt = promptStore.getPrompts[index]
      prompt.entries ??= []
      prompt.entries.push({ ...entry, author: userStore.getUser })
      promptStore.$patch({ _prompts: [...promptStore._prompts.slice(0, index), prompt, ...promptStore._prompts.slice(index + 1)] })

      entry.author = userStore.getUserRef

      this._isLoading = true
      await setDoc(entryRef, entry).catch((error) => {
        console.error(error)
        throw new Error(error)
      })

      await updateDoc(doc(db, 'prompts', promptId), { entries: arrayUnion(entryRef) }).catch((error) => {
        console.error(error)
        throw new Error(error)
      })
      this._isLoading = false
    },

    async editEntry(entry) {
      const promptStore = usePromptStore()
      const userStore = useUserStore()

      const promptId = entry.prompt.value
      entry.prompt = promptStore.getPromptRef(entry.prompt.value)
      entry.updated = Timestamp.fromDate(new Date())

      const prompts = promptStore.getPrompts
      const promptIndex = prompts.findIndex((prompt) => prompt.id === promptId)
      const prompt = prompts[promptIndex]
      const entryIndex = prompt.entries.findIndex((e) => e.id === entry.id)

      prompt.entries[entryIndex] = { ...entry, author: userStore.getUser }
      prompts[promptIndex] = prompt
      promptStore.$patch({ _prompts: prompts })

      this._isLoading = true
      await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'entries', entry.id), { ...entry })
      })
        .catch((error) => {
          console.error(error)
          throw new Error(error)
        })
        .finally(() => (this._isLoading = false))
    },

    async deleteEntry(entryDate) {
      const promptStore = usePromptStore()

      const promptId = entryDate.split('T')[0]
      const entries = promptStore.getPrompts.find((prompt) => prompt.id === promptId).entries
      const entryRef = doc(db, 'entries', entryDate)
      const entryImage = entries.find((entry) => entry.id === entryDate).image
      const imageRef = ref(storage, `images/${entryImage.split('?alt')[0].split('images%2F')[1]}`)

      this._isLoading = true
      const deleteImage = await deleteObject(imageRef)
      const deleteEntryDoc = await deleteDoc(doc(db, 'entries', entryDate))
      const deleteEntryRef = await updateDoc(doc(db, 'prompts', promptId), { entries: arrayRemove(entryRef) })

      Promise.all([deleteImage, deleteEntryDoc, deleteEntryRef])
        .then(() => {
          const prompt = promptStore.getPrompts.find((prompt) => prompt.id === promptId)
          prompt.entries = prompt.entries.filter((entry) => entry.id !== entryDate)
          promptStore.$patch({
            _prompts: [
              ...promptStore._prompts.slice(0, promptStore._prompts.indexOf(prompt)),
              prompt,
              ...promptStore._prompts.slice(promptStore._prompts.indexOf(prompt) + 1)
            ]
          })
        })
        .catch((error) => {
          console.error(error)
          throw new Error(error)
        })
        .finally(() => (this._isLoading = false))
    },

    async uploadImage(file, entryId) {
      const storageRef = ref(storage, `images/entry-${entryId}`)

      this._isLoading = true
      await uploadBytes(storageRef, file)
        .catch((error) => {
          console.error(error)
          throw new Error(error)
        })
        .finally(() => (this._isLoading = false))

      return getDownloadURL(ref(storage, storageRef))
    },

    async addLike(entryId){
      this._isLoading= true
      await useUserStore().loadBrowserId()
      let browserId = useUserStore().getBrowserId
      if(!entryId || !browserId){
        throw new Error('Entry or Browser id should be defined')
      }
      const entryOpinionRef = doc(db, 'entries', entryId, 'opinions', browserId)

      // First load prompt stored in the store
      let entryOpinion = await getDoc(entryOpinionRef).then((doc) => doc.data())
      if (entryOpinion && !entryOpinion.liked) {
        await setDoc(entryOpinionRef, { ...entryOpinion, liked: true, updatedAd: Date.now() })
      } else if (!entryOpinion) {
        await setDoc(entryOpinionRef, {
          liked: true,
          createdAt: Date.now(),
          updatedAd: Date.now()
        })
      }

      this._isLoading=false
    },
    async addDislike(entryId){
      this._isLoading= true
      await useUserStore().loadBrowserId()
      let browserId = useUserStore().getBrowserId
      if(!entryId || !browserId){
        throw new Error('Entry or Browser id should be defined')
      }
      const entryOpinionRef = doc(db, 'entries', entryId, 'opinions', browserId)

      // First load prompt stored in the store
      let entryOpinion = await getDoc(entryOpinionRef).then((doc) => doc.data())
      if (entryOpinion && entryOpinion.liked) {
        await setDoc(entryOpinionRef, { ...entryOpinion, liked: false, updatedAd: Date.now() })
      } else if (!entryOpinion) {
        await setDoc(entryOpinionRef, {
          liked: true,
          createdAt: Date.now(),
          updatedAd: Date.now()
        })
      }

      this._isLoading=false
    },
  }
})
