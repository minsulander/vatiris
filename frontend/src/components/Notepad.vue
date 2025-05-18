<template>
    <div style="width: 100%; height: 100%; background: #666; overflow-y: hidden">
        <div v-if="!auth.pending && !auth.user" style="height: 100%; background: #ddd; padding: 5px">
            Login to use notepad
        </div>
        <div v-else style="height: 100%; background: #777">
            <div id="notepad-toolbar">
                <button class="ql-header" value="1"></button>
                <button class="ql-header" value="2"></button>
                <button class="ql-bold"></button>
                <button class="ql-italic"></button>
                <button class="ql-underline"></button>
                <button class="ql-list" value="bullet"></button>
                <button class="ql-list" value="ordered"></button>
                <span class="float-right mr-1 pt-1 text-caption text-grey-lighten-2">
                    <v-btn
                        variant="text"
                        rounded="0"
                        size="small"
                        style="margin-top: -3px"
                        :style="{ color: contentLength > 0 ? '' : '#ccc !important' }"
                        @click="clear"
                        >CLEAR</v-btn
                    >
                </span>
            </div>
            <v-progress-linear
                indeterminate
                color="#33f"
                height="5"
                v-if="loading || auth.pending"
            ></v-progress-linear>
            <QuillEditor
                ref="editorRef"
                :toolbar="'#notepad-toolbar'"
                contentType="delta"
                @update:content="updateContent"
                style="
                    width: 100%;
                    height: calc(100% - 22px);
                    font-size: 15px;
                    margin: 0;
                    background: #ddd;
                "
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { Delta, QuillEditor } from "@vueup/vue-quill"
import { computed, onMounted, ref, watch } from "vue"
import useEventBus from "@/eventbus"
import "@vueup/vue-quill/dist/vue-quill.snow.css"
import "@/styles/quill.scss"
import { useAuthStore } from "@/stores/auth"

const editorRef = ref(null as any)
const auth = useAuthStore()
let postTimeout: any = undefined
const loading = ref(false)

const contentLength = ref(0)

function clear() {
    setEditorContent({ ops: [] })
    auth.postUserData("notepad", { text: JSON.stringify({ ops: [] }) })
}

let settingContent = false

async function updateContent(content: Delta) {
    const quill = editorRef.value?.getQuill()
    if (!quill) return
    contentLength.value = quill.getText().trim().length
    if (settingContent) return
    if (auth.user) {
        if (postTimeout) clearTimeout(postTimeout)
        postTimeout = setTimeout(() => {
            console.log("Posting notepad content", content.ops.length)
            postTimeout = undefined
            auth.postUserData("notepad", { text: JSON.stringify(content) })
        }, 1000)
    }
}

watch(
    () => auth.user,
    async () => {
        if (auth.user) fetchContent()
    },
)

onMounted(() => {
    if (auth.user) fetchContent()
})

const bus = useEventBus()
bus.on("refresh", () => {
    if (auth.user) fetchContent()
})

function setEditorContent(delta: object) {
    const quill = editorRef.value?.getQuill()
    if (quill) {
        settingContent = true
        quill.setContents(delta, "api")
        settingContent = false
    }
}

async function fetchContent() {
    loading.value = true
    try {
        const data = await auth.fetchUserData("notepad")
        try {
            const delta = data.text ? JSON.parse(data.text) : { ops: [] }
            setEditorContent(delta)
        } catch (e) {
            let delta: any = { ops: [] }
            if (typeof data.text === "string") {
                delta = {
                    ops: [{ insert: data.text + "\n" }],
                }
            }
            setEditorContent(delta)
        }
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.trashbin {
    border: none;
    cursor: pointer;
    height: 22px;
    display: flex;
    align-items: center;

    justify-content: center;
}
.trashbin span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-weight: bold;
}
.ql-snow.ql-toolbar button svg,
.ql-snow .ql-toolbar button svg {
    color: white !important;
}
.ql-stroke {
    stroke: white !important;
    color: white !important;
}
</style>
