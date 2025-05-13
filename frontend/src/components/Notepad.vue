<template>
    <div style="width: 100%; height: 100%; background: #666; overflow-y: hidden">
        <div style="height: 100%;  margin-left: -5px; background: #777">
            <div id="notepad-toolbar">
                <select class="ql-header">
                    <option selected></option>
                    <option value="1"></option>
                    <option value="2"></option>
                    <option value="3"></option>
                </select>
                <button class="ql-bold"></button>
                <button class="ql-italic"></button>
                <button class="ql-underline"></button>
                <button class="ql-list" value="bullet"></button>
                <button class="ql-list" value="ordered"></button>
                <button class="ql-clean" @click="clear"></button>
            </div>
            <QuillEditor
                ref="editorRef"
                :toolbar="'#notepad-toolbar'"
                v-model:content:delta="quillDelta"
                contentType="delta"
                @update:content="input"
                style="
                    width: 100%;
                    height: calc(100% - 25px);
                    font-size: 15px;
                    margin: 0;
                    color: black;
                    padding: 2px;
                    background: #ddd;
                    border-color: #777;
                "
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { QuillEditor } from "@vueup/vue-quill"
import { ref, watch, onMounted, nextTick } from "vue"
import useEventBus from "@/eventbus"
import { IconTrash } from "@tabler/icons-vue"
import "@vueup/vue-quill/dist/vue-quill.snow.css"
import "@/styles/quill.scss"
import { useAuthStore } from "@/stores/auth"

const editorRef = ref(null)
const auth = useAuthStore()
const quillDelta = ref<any>({ ops: [] })
let postTimeout: any = undefined

function clear() {
    setEditorContent({ ops: [] })
    auth.postUserData("notepad", { text: JSON.stringify({ ops: [] }) })
}

async function input(content) {
    if (postTimeout) clearTimeout(postTimeout)
    postTimeout = setTimeout(() => {
        console.log("Posting content", content.ops.length)
        postTimeout = undefined
        auth.postUserData("notepad", { text: JSON.stringify(content) })
    }, 1000)
}

watch(
    () => auth.user,
    async () => {
        if (auth.user) fetchContent()
    },
)

const bus = useEventBus()
bus.on("refresh", () => {
    if (auth.user) fetchContent()
})

function setEditorContent(delta) {
    const quill = editorRef.value?.getQuill()
    if (quill) {
        quill.setContents(delta, "api")
    }
}

async function fetchContent() {
    const data = await auth.fetchUserData("notepad")
    try {
        const delta = data.text ? JSON.parse(data.text) : { ops: [] }
        setEditorContent(delta)
    } catch (e) {
        console.error("Invalid Delta data in DB:", e)
        setEditorContent({ ops: [] })
    }
}
</script>
