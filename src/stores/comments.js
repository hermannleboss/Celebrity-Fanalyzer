import { collection, doc, getDoc, getDocs, query, setDoc, where, Timestamp } from 'firebase/firestore'
import { defineStore } from 'pinia'
import { db } from 'src/firebase'
import { useUserStore } from 'src/stores'

export const useCommentStore = defineStore('comments', {
  state: () => ({
    _comments: [],
    _entries: [],
    _isLoading: false
  }),

  getters: {
    getComments: (state) => state._comments,
    getEntries: (state) => state._entries,
    isLoading: (state) => state._isLoading
  },

  actions: {
    async fetchComments(slug) {
      this._isLoading = true
      const querySnapshot = await getDocs(query(collection(db, 'entries'), where('slug', '==', slug)))
      const entry = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))[0]

      entry.author = await getDoc(entry.author).then((doc) => doc.data())
      entry.prompt = await getDoc(entry.prompt).then((doc) => doc.data())

      const c = query(collection(db, 'entries', entry.id, 'comments'))
      const snap = await getDocs(c)
      const comments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

      for (const comment of comments) {
        comment.author = await getDoc(comment.author).then((doc) => doc.data())
      }
      this._isLoading = false

      this._comments = comments
    },

    async addComment(comment, entry) {
      const userStore = useUserStore()

      comment.author = userStore.getUserRef
      comment.id = new Date().toJSON()
      comment.created = Timestamp.fromDate(new Date())

      this._isLoading = true
      await setDoc(doc(db, 'entries', entry.id, 'comments', comment.id), comment)
        .then(() => this.$patch({ _comments: [...this._comments, { ...comment, author: userStore.getUser }] }))
        .catch((err) => {
          console.log(err)
          throw new Error(err)
        })
        .finally(() => (this._isLoading = false))
    },

    async editComment(entry) {
      console.log(entry)
    },

    async deleteComment(id, entry) {
      console.log(id)
      this._isLoading = true
      const deleteComment = await deleteDoc(doc(db, 'comments', id))
      console.log(deleteComment)
      Promise.all([deleteComment])
        .then(() => {
          this.$patch({ _comments: [...this._comments, comment] })
        })
        .catch((error) => {
          console.error(error)
          throw new Error(error)
        })
        .finally(() => (this._isLoading = false))
    }
  }
})
