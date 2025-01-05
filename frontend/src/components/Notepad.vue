<template>
    <div style="width: 100%; height: 100%; background: #666; overflow-y: hidden">
        <div style="height: 25px; margin-top: -5px; margin-left: -5px; background: #777">
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="text.length > 0 ? 'white' : 'grey-lighten-1'"
                @click="clear"
                >CLEAR</v-btn
            >
        </div>
        <textarea
            light
            v-model="text"
            style="
                width: 100%;
                height: calc(100% - 20px);
                font-size: 15px;
                color: black;
                padding: 2px;
                background: #ddd;
                border-color: transparent;
            "
            spellcheck="false"
            :placeholder="auth.user ? 'Type here...' : 'Login to save your notes'"
            :readonly="!auth.user"
            @input="input"
        />
    </div>
</template>

<script setup lang="ts">
import useEventBus from "@/eventbus"
import { useAuthStore } from "@/stores/auth"
import { onMounted, ref, watch } from "vue"

const text = ref("")

const auth = useAuthStore()

let postTimeout: any = undefined

function clear() {
    text.value = ""
    input()
}

function input() {
    if (postTimeout) clearTimeout(postTimeout)
    postTimeout = setTimeout(() => {
        console.log("Posting content", text.value.length)
        postTimeout = undefined
        auth.postUserData("notepad", { text: text.value })
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

async function fetchContent() {
    const data = await auth.fetchUserData("notepad")
    if (data.text) text.value = data.text
}
</script>
