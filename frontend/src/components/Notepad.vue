<template>
    <div style="width: 100%; height: 100%; background: #666; overflow-y: hidden">
        <div style="height: 25px; margin-top: -5px; margin-left: -5px; background: #777">
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="quillDelta.length > 0 ? 'white' : 'grey-lighten-1'"
                @click="clear"
            >
                CLEAR
            </v-btn>
        </div>

        <QuillEditor
            ref="editorRef"
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
                border-color: transparent;
            "
        />
    </div>
</template>

<script setup lang="ts">
import { QuillEditor, Quill } from "@vueup/vue-quill"
import { ref, watch, onMounted } from "vue"
import useEventBus from "@/eventbus"
import "@vueup/vue-quill/dist/vue-quill.snow.css"
import { useAuthStore } from "@/stores/auth"

const editorRef = ref(null)
const auth = useAuthStore()
const quillDelta = ref<any>({ ops: [] })
let postTimeout: any = undefined

function clear() {
    setEditorContent({ ops: [] })
    input({ content: { ops: [] } })
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

onMounted(async () => {
    if (auth.user) fetchContent()
})

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
