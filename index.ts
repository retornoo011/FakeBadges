/*
 * FakeBadges - local-only profile badges for your own Discord client.
 * v14.2: Limits hide-originals DOM filtering to the current user profile only.
 * v14.1: Filters native badges before Discord calculates the profile overflow count.
 * v12: Adds a local detail view when clicking an experimental badge preview.
 * Uses Discord CDN SVG artwork for all four experimental badge tiers.
 * Customize Badges shows only enabled fake badges; replaced native badges are hidden locally.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { addProfileBadge, BadgePosition, type ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Button } from "@components/Button";
import { OwnerCrownIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import { React, useState, UserStore } from "@webpack/common";

const badgeDefinitions = {
    staff: { name: "Discord Staff", hash: "5e74e9b61934fc1f67c65515d1f7e60d" },
    partner: { name: "Partner", hash: "3f9748e53446a137a052f3454e2de41e" },
    hypesquad: { name: "HypeSquad Events", hash: "bf01d1073931f921909045f3a39fd264" },
    bugHunter: { name: "Discord Bug Hunter", hash: "2717692c7dca7289b35297368a940dd0" },
    bugHunterGold: { name: "Discord Bug Hunter Gold", hash: "848f79194d4be5ff5f81505cbd0ce1e6" },
    earlySupporter: { name: "Early Supporter", hash: "7060786766c9c840eb3019e725d2b358" },
    verifiedDeveloper: { name: "Early Verified Bot Developer", hash: "6df5892e0f35b051f8b61eace34f4967" },
    activeDeveloper: { name: "Active Developer", hash: "6bdc42827a38498929a4920da12695d9" },
    nitro: { name: "Discord Nitro", hash: "2ba85e8026a8614b640c2837bcdfe21b" },
    nitro1Month: { name: "Nitro Subscriber — 1 Month (Bronze)", hash: "4f33c4a9c64ce221936bd256c356f91f" },
    nitro3Months: { name: "Nitro Subscriber — 3 Months (Silver)", hash: "4514fab914bdbfb4ad2fa23df76121a6" },
    nitro6Months: { name: "Nitro Subscriber — 6 Months (Gold)", hash: "2895086c18d5531d499862e41d1155a6" },
    nitro1Year: { name: "Nitro Subscriber — 1 Year (Platinum)", hash: "0334688279c8359120922938dcb1d6f8" },
    nitro2Years: { name: "Nitro Subscriber — 2 Years (Diamond)", hash: "0d61871f72bb9a33a7ae568c1fb4f20a" },
    nitro3Years: { name: "Nitro Subscriber — 3 Years (Emerald)", hash: "11e2d339068b55d3a506cff34d3780f3" },
    nitro5Years: { name: "Nitro Subscriber — 5 Years (Ruby)", hash: "cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4" },
    nitro6Years: { name: "Nitro Subscriber — 6 Years (Opal)", hash: "5b154df19c53dce2af92c9b61e6be5e2" }
} as const;

type LegacyBadgeKey = keyof typeof badgeDefinitions;
type ExperimentalBadgeKey = "accountAge" | "gameTime" | "gameVariety" | "streamingTime";
type BadgeKey = LegacyBadgeKey | ExperimentalBadgeKey;

const levels = {
    accountAge: ["seed", "sprout", "sapling", "bud", "blossom", "redwood", "sequoia", "bristlecone", "stromatolite", "primordial"],
    gameTime: ["casual", "recreational", "dedicated", "committed", "serious", "devoted", "seasoned", "ironclad", "unshakeable", "eternal"],
    gameVariety: ["sampler", "dabbler", "enthusiast", "ranger", "explorer", "adventurer", "voyager", "maverick", "polymath", "universalist"],
    streamingTime: ["newcomer", "fledgling", "breakout", "standout", "trendsetter", "headliner", "star", "sensation", "visionary", "phenomenon"]
} as const;

const levelLabels = {
    accountAge: ["Seed — 1 año", "Sprout — 2 años", "Sapling — 3 años", "Bud — 4 años", "Blossom — 5 años", "Redwood — 6 años", "Sequoia — 7 años", "Bristlecone — 8 años", "Stromatolite — 9 años", "Primordial — 10+ años"],
    gameTime: ["Casual — 1 h", "Recreational — 5 h", "Dedicated — 20 h", "Committed — 75 h", "Serious — 150 h", "Devoted — 300 h", "Seasoned — 500 h", "Ironclad — 1.000 h", "Unshakeable — 2.000 h", "Eternal — 5.000+ h"],
    gameVariety: ["Sampler — 2 juegos", "Dabbler — 5 juegos", "Enthusiast — 10 juegos", "Ranger — 15 juegos", "Explorer — 20 juegos", "Adventurer — 30 juegos", "Voyager — 40 juegos", "Maverick — 60 juegos", "Polymath — 80 juegos", "Universalist — 100+ juegos"],
    streamingTime: ["Newcomer — 1 h", "Fledgling — 5 h", "Breakout — 20 h", "Standout — 75 h", "Trendsetter — 150 h", "Headliner — 300 h", "Star — 500 h", "Sensation — 1.000 h", "Visionary — 2.000 h", "Phenomenon — 5.000+ h"]
} as const;

// Official Discord CDN artwork transcribed from the four native detail panels.
// The selected tier now uses Discord's original SVG instead of third-party PNGs.
const experimentalBadgeArtwork: Record<ExperimentalBadgeKey, Record<string, string>> = {
    accountAge: {
        seed: "465f6cc202c60d0e250f986fa035ed461e275adddbf875106089527a2c16ef2c",
        sprout: "2f2f1d83c3abedbbd2346212343e3f45bd215ddd3d97fdf2272f3c3b4ea52dae",
        sapling: "b9f15d9592f7a4fab4f7295e59bbc9cf45cc4787505eafc17e1586e499d4b64a",
        bud: "5a8088ae64ce072f086049e862b9c6fb94a34be8c1de85870cebd4a7db0596ff",
        blossom: "6b236652251f52ab8d0183934bbcd2f3246ac531cecb8d86569d24cbdc8eb1f4",
        redwood: "018ba2a1ebd7321265af6496af5f131d59002c4f90eadcf93d0da023dea486fa",
        sequoia: "2a598969188c36a8292855ca82a6acd953b7adab398721a65bfd360f55eed26a",
        bristlecone: "5dc6789b3102d1d63b3a4e257bc0067555702116f392d54cd3f83c0c137e6e11",
        stromatolite: "3251cbd59d4b048fc5ea83890cfb78fe2e092865ebbf8eff61dcd861af4b5fc7",
        primordial: "895ded0aa669176a4c45b41f18f992ea1a762a57d99edab380377162d54851e5"
    },
    gameTime: {
        casual: "b75fcc4dd1c65dfd4169a203e21023453fd6fe853c9b5c1fd839781fda98e80d",
        recreational: "68b84fae379e1370b3216b3fe1243b6d7c9d9ae631c5f7416d35d20d3ea0fa04",
        dedicated: "e0c82f41bcad94a2a52713800fbef7687d0d2c6a6066b09d5e5876156d086e1a",
        committed: "8e0ecf91470745aef93dc5b7bdce31b4e43c44632141a3d71da93bd89ca4db2d",
        serious: "ba26e83fa68189b41837184e38706f41c288dd29ffba266035d1a5ad9adbae22",
        devoted: "851b194288f1913ece6c8d99976519e48210580d6f42d994f21e37801611ad54",
        seasoned: "8b10f5c0c30abbd521be5afc2e0dd4ec6da18bfbc689f06d93a51d06577cd84a",
        ironclad: "d705628490898f2cc22d669cf8b415bc03fed1ddaf98a2a8cbd97442a509293c",
        unshakeable: "2bddcbc9f9959dab805eb7196c8112ce9dc68b09766c8193ab499b1870e44ac7",
        eternal: "457ce4e657f0ced23197891cc3d75b7de29cafa065cdb8cbb81060ac0e63b07f"
    },
    gameVariety: {
        sampler: "ed18d5976c01a4ea19f5a13af08f0547582405cbe48b098b0822e352b8e0a822",
        dabbler: "e450d5279537db06ee47a104af520b884adaa7ffc3ef2627157526bf1c58e840",
        enthusiast: "158a9d91b8ca9e96d4afeee38cd640fc51483a8196edb9af0c26e44727acafae",
        ranger: "9e491942070007f64011ae4fc478926b96433698c07621fc43bafdd5efe83912",
        explorer: "e25fc55814262150e154ddb1a2b55fc5ed8ed5ba2ff1a22a33d4a41e651e370a",
        adventurer: "542d5277e0001ea738d5eb57b247dcab9ce6e0c29493d5892203f6258fde55b9",
        voyager: "082e693cb9ce98b81af618978d449409efc6522b061bc0eac6e88a949fd888c6",
        maverick: "6fc242e9e8259c471a5e4599cd09af5476e622a572ff235883173913bf506103",
        polymath: "be9a4d119b8e0d7fc1df7e5a12081332637cb9c978a90377cb9c930500b2fbe6",
        universalist: "fcc34d343451505c642f3397cec2669a2de3a4a410fb968f794b3a1a0dcd1728"
    },
    streamingTime: {
        newcomer: "c56b451e3bf04181182c2529e9bd3659e569ea80f582858090007f0752401b38",
        fledgling: "2e25ba794f6f371ea0f52eb2d3c8fb2b04094a56f388515e13a9bd6d7949a018",
        breakout: "4e847b4dca20fbf1c56d3a47cac3c9204f02113c9d5a270ebebdf12909c75848",
        standout: "27d0e6939f13dcf113243fc9eac642b15e9764ad891e06c5ed78d45a17678582",
        trendsetter: "af681483be2035f14b0f2bfe2e25a8944c97149172938888ca1008edbe037aad",
        headliner: "e69a0c86a476c9782ea1d3e7b5ba308eec3d9d6a3eae6ab8af3180f67d16b468",
        star: "06b6206db966635cf626651bdb94eacce5a23ab05dc7f600f7d31aa482b2058c",
        sensation: "1a3b9120ecd64c342083c37980b225d29ebf4544da6ab546c9268f87904c9dfe",
        visionary: "85f714b90ed3ceb1e00e1f2069bf3ebd564962fa940c92540061537a045e54ab",
        phenomenon: "61331d04b7a9542b38bfa59583360c0b9b93c6496a04f99c0ab37fa1d83ec58a"
    }
};

const levelDisplayNames: Record<ExperimentalBadgeKey, Record<string, string>> = {
    accountAge: { seed: "Seed", sprout: "Sprout", bud: "Bud", sapling: "Sapling", blossom: "Blossom", redwood: "Redwood", sequoia: "Sequoia", bristlecone: "Bristlecone", stromatolite: "Stromatolite", primordial: "Primordial" },
    gameTime: { casual: "Casual", recreational: "Recreational", dedicated: "Dedicated", committed: "Committed", serious: "Serious", devoted: "Devoted", seasoned: "Seasoned", ironclad: "Ironclad", unshakeable: "Unshakeable", eternal: "Eternal" },
    gameVariety: { sampler: "Sampler", dabbler: "Dabbler", enthusiast: "Enthusiast", ranger: "Ranger", explorer: "Explorer", adventurer: "Adventurer", voyager: "Voyager", maverick: "Maverick", polymath: "Polymath", universalist: "Universalist" },
    streamingTime: { newcomer: "Newcomer", fledgling: "Fledgling", breakout: "Breakout", standout: "Standout", trendsetter: "Trendsetter", headliner: "Headliner", star: "Star", sensation: "Sensation", visionary: "Visionary", phenomenon: "Phenomenon" }
};

const experimentalBadges: Record<ExperimentalBadgeKey, { name: string; image: (level: string) => string }> = {
    accountAge: { name: "Account Age", image: level => `https://cdn.discordapp.com/assets/content/${experimentalBadgeArtwork.accountAge[level] ?? experimentalBadgeArtwork.accountAge.seed}.svg` },
    gameTime: { name: "Game Time", image: level => `https://cdn.discordapp.com/assets/content/${experimentalBadgeArtwork.gameTime[level] ?? experimentalBadgeArtwork.gameTime.casual}.svg` },
    gameVariety: { name: "Game Variety", image: level => `https://cdn.discordapp.com/assets/content/${experimentalBadgeArtwork.gameVariety[level] ?? experimentalBadgeArtwork.gameVariety.sampler}.svg` },
    streamingTime: { name: "Streaming", image: level => `https://cdn.discordapp.com/assets/content/${experimentalBadgeArtwork.streamingTime[level] ?? experimentalBadgeArtwork.streamingTime.newcomer}.svg` }
};

// Build the Customize Badges previews only from badges currently enabled
// in FakeBadges. Experimental badges use the selected level image.
function getActiveFakeBadgeCatalog() {
    if (!settings.store.badgesEnabled) return [];

    const active: Array<{ key: string; name: string; image: string }> = [];
    for (const [key, value] of Object.entries(badgeDefinitions)) {
        if (!settings.store[key as LegacyBadgeKey]) continue;
        active.push({
            key,
            name: value.name,
            image: `https://cdn.discordapp.com/badge-icons/${value.hash}.png`
        });
    }

    for (const [key, value] of Object.entries(experimentalBadges)) {
        const experimentalKey = key as ExperimentalBadgeKey;
        if (!settings.store[experimentalKey]) continue;
        const selectedLevel = (settings.store as any)[`${key}Level`] as string;
        active.push({
            key,
            name: `${value.name} — ${levelDisplayNames[experimentalKey][selectedLevel] ?? selectedLevel}`,
            image: value.image(selectedLevel)
        });
    }

    return active;
}

const equippedBadges = new Map<BadgeKey, ProfileBadge>();

const selectOptions = (labels: readonly string[], values: readonly string[]) => values.map((value, index) => ({ label: labels[index], value }));

let refreshBadges: () => void;

const settings = definePluginSettings({
    staff: { type: OptionType.BOOLEAN, description: "Show Discord Staff badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    partner: { type: OptionType.BOOLEAN, description: "Show Partner badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    hypesquad: { type: OptionType.BOOLEAN, description: "Show HypeSquad badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    bugHunter: { type: OptionType.BOOLEAN, description: "Show Bug Hunter badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    bugHunterGold: { type: OptionType.BOOLEAN, description: "Show Bug Hunter Gold badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    earlySupporter: { type: OptionType.BOOLEAN, description: "Show Early Supporter badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    verifiedDeveloper: { type: OptionType.BOOLEAN, description: "Show Verified Developer badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    activeDeveloper: { type: OptionType.BOOLEAN, description: "Show Active Developer badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro: { type: OptionType.BOOLEAN, description: "Show Nitro badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro1Month: { type: OptionType.BOOLEAN, description: "Show Nitro 1-month Bronze badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro3Months: { type: OptionType.BOOLEAN, description: "Show Nitro 3-month Silver badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro6Months: { type: OptionType.BOOLEAN, description: "Show Nitro 6-month Gold badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro1Year: { type: OptionType.BOOLEAN, description: "Show Nitro 1-year Platinum badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro2Years: { type: OptionType.BOOLEAN, description: "Show Nitro 2-year Diamond badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro3Years: { type: OptionType.BOOLEAN, description: "Show Nitro 3-year Emerald badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro5Years: { type: OptionType.BOOLEAN, description: "Show Nitro 5-year Ruby badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },
    nitro6Years: { type: OptionType.BOOLEAN, description: "Show Nitro 6-year Opal badge locally.", default: false, hidden: true, onChange: () => refreshBadges() },

    accountAge: { type: OptionType.BOOLEAN, description: "Replace your real Account Age badge with the selected level.", default: false, hidden: true, onChange: () => refreshBadges() },
    accountAgeLevel: { type: OptionType.SELECT, description: "Account Age level", options: selectOptions(levelLabels.accountAge, levels.accountAge), default: "seed", hidden: true, onChange: () => refreshBadges() },
    gameTime: { type: OptionType.BOOLEAN, description: "Replace your real Game Time badge with the selected level.", default: false, hidden: true, onChange: () => refreshBadges() },
    gameTimeLevel: { type: OptionType.SELECT, description: "Game Time level", options: selectOptions(levelLabels.gameTime, levels.gameTime), default: "casual", hidden: true, onChange: () => refreshBadges() },
    gameVariety: { type: OptionType.BOOLEAN, description: "Replace your real Games Played badge with the selected level.", default: false, hidden: true, onChange: () => refreshBadges() },
    gameVarietyLevel: { type: OptionType.SELECT, description: "Games Played / Game Variety level", options: selectOptions(levelLabels.gameVariety, levels.gameVariety), default: "sampler", hidden: true, onChange: () => refreshBadges() },
    streamingTime: { type: OptionType.BOOLEAN, description: "Replace your real Streaming Time badge with the selected level.", default: false, hidden: true, onChange: () => refreshBadges() },
    streamingTimeLevel: { type: OptionType.SELECT, description: "Streaming Time level", options: selectOptions(levelLabels.streamingTime, levels.streamingTime), default: "newcomer", hidden: true, onChange: () => refreshBadges() },

    // Controlled by the two action buttons in the plugin settings panel.
    badgesEnabled: { type: OptionType.BOOLEAN, description: "Internal: enable FakeBadges", default: false, hidden: true, onChange: () => refreshBadges() },
    hideAllOriginalBadges: { type: OptionType.BOOLEAN, description: "Internal: hide all native badges locally", default: false, hidden: true, onChange: () => syncOriginalBadges() }
});

let currentUserId: string | undefined;
let badgeObserver: MutationObserver | undefined;

// Filter native badges BEFORE BadgeAPI calculates Discord's six-icon limit
// and +N overflow count. The DOM hiding below remains unchanged and continues
// to handle the visible profile row and the separate badge panels.
function getNativeBadgeText(badge: unknown): string {
    if (!badge || typeof badge !== "object") return String(badge ?? "");

    // Include nested badge data too: some Discord/Vencord builds store the
    // display name or artwork identifier inside an icon/descriptor object.
    const topLevelText = Object.entries(badge as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => `${key} ${value}`)
        .join(" ");

    let serialized = "";
    try {
        serialized = JSON.stringify(badge);
    } catch {
        // Circular client objects can still be filtered by their top-level fields.
    }

    return `${topLevelText} ${serialized}`.toLowerCase();
}

const nativeBadgeMatchers: Record<ExperimentalBadgeKey, RegExp> = {
    accountAge: /account[\s_-]*age|c2ff7d8d6285305f969be81c3c92dd78|6b236652251f52ab8d0183934bbcd2f3246ac531cecb8d86569d24cbdc8eb1f4/i,
    gameTime: /game[\s_-]*time|be98f2d9a07ba288bf271b0757fbce6a|2bddcbc9f9959dab805eb7196c8112ce9dc68b09766c8193ab499b1870e44ac7/i,
    gameVariety: /game[\s_-]*(?:variety|diversity|played)|games[\s_-]*played|2ec2aa257c6fa9adb68c79b7b98b39a2|fcc34d343451505c642f3397cec2669a2de3a4a410fb968f794b3a1a0dcd1728/i,
    streamingTime: /stream(?:ing)?[\s_-]*(?:time|badge)?|3ba1b4e528fdebfe49cd7021550e9826|61331d04b7a9542b38bfa59583360c0b9b93c6496a04f99c0ab37fa1d83ec58a/i
};

function shouldFilterNativeBadge(badge: unknown): boolean {
    if (settings.store.hideAllOriginalBadges) return true;
    if (!settings.store.badgesEnabled) return false;

    const text = getNativeBadgeText(badge);
    return (Object.keys(nativeBadgeMatchers) as ExperimentalBadgeKey[]).some(key =>
        !!settings.store[key] && nativeBadgeMatchers[key].test(text)
    );
}

function filterNativeProfileBadges<T>(nativeBadges: T[], targetUserId?: string): T[] {
    if (!Array.isArray(nativeBadges)) return nativeBadges;
    if (!currentUserId || targetUserId !== currentUserId) return nativeBadges;

    return nativeBadges.filter(badge => {
        // FakeBadges are passed separately by Discord as pending badges. Never
        // remove them here, even if their labels resemble native badges.
        if (badge && typeof badge === "object") {
            const id = String((badge as any).id ?? "");
            if (id.startsWith("fake-badges-")) return true;
        }

        return !shouldFilterNativeBadge(badge);
    });
}

// Discord calculates the six-icon limit and +N count in UserProfileBadgeListRows
// after collecting native badges. Expose this filter for the targeted patch
// below so the native array is cleaned before that calculation takes place.
function installBadgeArrayFilter() {
    (globalThis as any).__fakeBadgesFilterNative = filterNativeProfileBadges;
}

function uninstallBadgeArrayFilter() {
    if ((globalThis as any).__fakeBadgesFilterNative === filterNativeProfileBadges) {
        delete (globalThis as any).__fakeBadgesFilterNative;
    }
}

// Keep the original inline display value so disabling a replacement (or
// stopping the plugin) restores Discord's original badge without touching
// any unrelated badge.
const hiddenOriginalBadges = new Map<HTMLAnchorElement, { display: string; priority: string }>();

// Discord's "Customize your badges" directory uses a separate list from the
// profile badge row. Keep its original values so we can replace/restore the
// four experimental badge tiles without changing the account inventory.
type DirectoryBadgeSnapshot = {
    ariaLabel: string | null;
    imageSrc: string | null;
    display: string;
    displayPriority: string;
};
const directoryBadgeSnapshots = new Map<HTMLElement, DirectoryBadgeSnapshot>();

// The profile popout's "Customize your badges" panel is a different React
// surface from the badge directory. Its native tiles use these exact CDN
// assets (confirmed from the user's Vencord/Discord DOM).
const customizeOriginalBadgeImages: Record<ExperimentalBadgeKey, string> = {
    gameVariety: "https://cdn.discordapp.com/assets/content/fcc34d343451505c642f3397cec2669a2de3a4a410fb968f794b3a1a0dcd1728.svg",
    gameTime: "https://cdn.discordapp.com/assets/content/2bddcbc9f9959dab805eb7196c8112ce9dc68b09766c8193ab499b1870e44ac7.svg",
    streamingTime: "https://cdn.discordapp.com/assets/content/06b6206db966635cf626651bdb94eacce5a23ab05dc7f600f7d31aa482b2058c.svg",
    accountAge: "https://cdn.discordapp.com/assets/content/6b236652251f52ab8d0183934bbcd2f3246ac531cecb8d86569d24cbdc8eb1f4.svg"
};

type CustomizeBadgeSnapshot = {
    src: string | null;
    container: HTMLElement;
    display: string;
    displayPriority: string;
};
const customizeBadgeSnapshots = new Map<HTMLImageElement, CustomizeBadgeSnapshot>();

const originalBadgeNames: Record<ExperimentalBadgeKey, RegExp> = {
    accountAge: /^Account Age(?:$|\s*[,—-])/i,
    gameTime: /^Game Time(?:$|\s*[,—-])/i,
    gameVariety: /^(?:Games Played(?:\s*\/\s*Game Variety)?|Game Variety)(?:$|\s*[,—-])/i,
    streamingTime: /^(?:Streaming Time|Streaming)(?:$|\s*[,—-])/i
};

const directoryOriginalBadgeNames: Record<ExperimentalBadgeKey, RegExp> = {
    accountAge: /^Account Age(?:\s*[,—-]|$)/i,
    gameTime: /^Game Time(?:\s*[,—-]|$)/i,
    gameVariety: /^(?:Game Variety|Games Played)(?:\s*[,—-]|$)/i,
    streamingTime: /^Streaming(?: Time)?(?:\s*[,—-]|$)/i
};

const fakeBadgeImagePatterns: Record<ExperimentalBadgeKey, string> = {
    accountAge: "/account_age_",
    gameTime: "/game_time_",
    gameVariety: "/game_variety_",
    streamingTime: "/streaming_"
};

function getExperimentalKeyFromFakeBadge(anchor: HTMLAnchorElement): ExperimentalBadgeKey | undefined {
    const src = anchor.querySelector<HTMLImageElement>("img")?.getAttribute("src") ?? "";
    if (!src.includes("raw.githubusercontent.com/dev-hoehle/discord-badges/")) return;

    return (Object.keys(fakeBadgeImagePatterns) as ExperimentalBadgeKey[])
        .find(key => src.includes(fakeBadgeImagePatterns[key]));
}

function isFakeBadgesOwnedBadge(anchor: HTMLAnchorElement): boolean {
    const src = anchor.querySelector<HTMLImageElement>("img")?.getAttribute("src") ?? "";
    if (src.includes("raw.githubusercontent.com/dev-hoehle/discord-badges/")) return true;

    // Preserve legacy fake badges supplied by this plugin.
    if (Object.values(badgeDefinitions).some(({ hash }) => src.includes(`/badge-icons/${hash}.png`))) {
        return true;
    }

    // Experimental fake badges are identified by their own aria-label
    // ("Game Variety — Universalist"), not aria-describedby. Discord's native
    // Games Played badge also describes its level in aria-describedby, so the
    // old check accidentally classified the native badge as a fake one.
    if (!settings.store.badgesEnabled) return false;

    const label = (anchor.getAttribute("aria-label") ?? "").toLowerCase()
        .replace(/[—–-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    for (const key of Object.keys(experimentalBadges) as ExperimentalBadgeKey[]) {
        if (!settings.store[key]) continue;

        const selectedLevel = (settings.store as any)[`${key}Level`] as string;
        const expectedLabel =
            `${experimentalBadges[key].name} ${levelDisplayNames[key][selectedLevel] ?? selectedLevel}`
                .toLowerCase().replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim();

        if (label === expectedLabel) return true;
    }

    return false;
}

function restoreOriginalBadge(anchor: HTMLAnchorElement) {
    const previous = hiddenOriginalBadges.get(anchor);
    if (!previous) return;

    if (previous.display) anchor.style.setProperty("display", previous.display, previous.priority);
    else anchor.style.removeProperty("display");
    hiddenOriginalBadges.delete(anchor);
}

// Resolve the user ID from the React tree surrounding a profile element.
// The profile row can exist for many users at once (for example, an open
// popout while browsing a server), so DOM badge hiding must be scoped to the
// signed-in user's own profile. If Discord does not expose an ID, fail closed.
function getReactTreeUserId(element: HTMLElement): string | undefined {
    const readUserId = (props: any): string | undefined => {
        if (!props || typeof props !== "object") return undefined;
        const candidates = [
            props.userId,
            props.user?.id,
            props.user?.userId,
            props.displayProfile?.userId,
            props.displayProfile?.user?.id,
            props.profile?.userId,
            props.profile?.user?.id,
            props.userProfile?.userId,
            props.userProfile?.user?.id
        ];
        const found = candidates.find(value => value != null && String(value).length > 0);
        return found == null ? undefined : String(found);
    };

    let node: HTMLElement | null = element;
    while (node) {
        const dataUserId = node.getAttribute("data-user-id")
            ?? node.getAttribute("data-userid");
        if (dataUserId) return dataUserId;

        for (const key of Object.keys(node)) {
            const value = (node as any)[key];
            if (key.startsWith("__reactProps$")) {
                const userId = readUserId(value);
                if (userId) return userId;
                continue;
            }
            if (!key.startsWith("__reactFiber$")) continue;

            let fiber: any = value;
            let depth = 0;
            while (fiber && depth++ < 100) {
                const userId = readUserId(fiber.memoizedProps ?? fiber.pendingProps);
                if (userId) return userId;
                fiber = fiber.return;
            }
        }
        node = node.parentElement;
    }
    return undefined;
}

function isProfileBadgeAnchor(anchor: HTMLAnchorElement): boolean {
    // Do not touch the owned-badge directory or the Customize Badges grid.
    if (anchor.closest('[data-list-id="badge-directory-owned"]')) return false;
    if (anchor.closest('.badgeGrid_i44TZ4, [data-fakebadges-catalog]')) return false;

    const image = anchor.querySelector<HTMLImageElement>("img");
    const src = image?.getAttribute("src") ?? "";
    if (!src || !anchor.hasAttribute("aria-label")) return false;

    // Native Discord profile badges are served from these badge artwork paths.
    // This deliberately does not depend on Discord's frequently-renamed CSS
    // module classes (the old container_* + managed_* selector was brittle).
    return src.includes("cdn.discordapp.com/badge-icons/")
        || (src.includes("cdn.discordapp.com/assets/content/") && /\.svg(?:\?|$)/i.test(src));
}

function syncOriginalBadges() {
    if (typeof document === "undefined") return;

    const shouldHide = new Set<HTMLAnchorElement>();

    // Scan badge links themselves rather than relying on the old
    // div[class*=container_][class*=managed_] wrapper. Discord changed that
    // wrapper class, which left this function affecting only the separate
    // Your Badges/Customize panels while the row under the username remained.
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[aria-label]');

    for (const anchor of anchors) {
        if (!isProfileBadgeAnchor(anchor)) continue;
        // Never hide badges belonging to another user. If the profile owner
        // cannot be identified, leave that profile untouched.
        if (!currentUserId || getReactTreeUserId(anchor) !== currentUserId) continue;
        if (isFakeBadgesOwnedBadge(anchor)) continue;

        if (settings.store.hideAllOriginalBadges) {
            shouldHide.add(anchor);
            continue;
        }

        if (!settings.store.badgesEnabled) continue;
        const label = anchor.getAttribute("aria-label") ?? "";
        for (const key of Object.keys(originalBadgeNames) as ExperimentalBadgeKey[]) {
            if (settings.store[key] && originalBadgeNames[key].test(label)) {
                shouldHide.add(anchor);
                break;
            }
        }
    }

    for (const anchor of shouldHide) {
        if (!hiddenOriginalBadges.has(anchor)) {
            hiddenOriginalBadges.set(anchor, {
                display: anchor.style.getPropertyValue("display"),
                priority: anchor.style.getPropertyPriority("display")
            });
        }
        anchor.style.setProperty("display", "none", "important");
    }

    for (const anchor of hiddenOriginalBadges.keys()) {
        if (!shouldHide.has(anchor) || !anchor.isConnected) restoreOriginalBadge(anchor);
    }
}

function isFakeDirectorySlot(slot: HTMLElement): boolean {
    const image = slot.querySelector<HTMLImageElement>("img");
    const src = image?.getAttribute("src") ?? "";
    return (slot.id || "").includes("fake-badges-")
        || src.includes("raw.githubusercontent.com/dev-hoehle/discord-badges/");
}

function syncBadgeDirectory() {
    if (typeof document === "undefined") return;

    const ownedGrid = document.querySelector<HTMLElement>(
        '[data-list-id="badge-directory-owned"]'
    );
    if (!ownedGrid) return;

    const currentSlots = new Set(ownedGrid.querySelectorAll<HTMLElement>('[role="tab"][aria-label]'));

    for (const slot of currentSlots) {
        // Fake slots are supplied by BadgeAPI. Never hide or rewrite them.
        if (isFakeDirectorySlot(slot)) continue;

        let snapshot = directoryBadgeSnapshots.get(slot);
        if (!snapshot) {
            snapshot = {
                ariaLabel: slot.getAttribute("aria-label"),
                imageSrc: slot.querySelector<HTMLImageElement>("img")?.getAttribute("src") ?? null,
                display: slot.style.getPropertyValue("display"),
                displayPriority: slot.style.getPropertyPriority("display")
            };
            directoryBadgeSnapshots.set(slot, snapshot);
        }

        const label = snapshot.ariaLabel ?? "";
        const replacementKey = (Object.keys(directoryOriginalBadgeNames) as ExperimentalBadgeKey[])
            .find(key => directoryOriginalBadgeNames[key].test(label));
        const replacedByFake = !!(
            replacementKey && settings.store.badgesEnabled && settings.store[replacementKey]
        );
        const shouldHide = !!settings.store.hideAllOriginalBadges || replacedByFake;

        if (shouldHide) {
            slot.style.setProperty("display", "none", "important");
        } else {
            if (snapshot.display) slot.style.setProperty("display", snapshot.display, snapshot.displayPriority);
            else slot.style.removeProperty("display");
        }
    }

    // Remove detached nodes so React replacements can be snapshotted cleanly.
    for (const [slot] of directoryBadgeSnapshots) {
        if (!slot.isConnected) directoryBadgeSnapshots.delete(slot);
    }
}

function syncCustomizeBadgesPanel() {
    if (typeof document === "undefined") return;

    const panel = document.querySelector<HTMLElement>(
        '.content_i44TZ4 .badgeGrid_i44TZ4[role="group"][aria-label="User Badges"]'
    );
    if (!panel) return;
    // The same panel component can be rendered while viewing another user.
    // Only alter the signed-in user's own Customize Badges panel.
    if (!currentUserId || getReactTreeUserId(panel) !== currentUserId) return;

    // Keep the four native experimental tiles hidden when replaced, and hide
    // every native tile when the global hide-originals switch is enabled.
    const nativeImages = panel.querySelectorAll<HTMLImageElement>(
        '.badgeTileContainer_i44TZ4 .badgeTile_i44TZ4 img.badgeTileIcon_i44TZ4'
    );
    for (const image of nativeImages) {
        const container = image.closest<HTMLElement>(".badgeTileContainer_i44TZ4");
        if (!container || container.hasAttribute("data-fakebadges-catalog")) continue;

        let snapshot = customizeBadgeSnapshots.get(image);
        if (!snapshot) {
            snapshot = {
                src: image.getAttribute("src"),
                container,
                display: container.style.getPropertyValue("display"),
                displayPriority: container.style.getPropertyPriority("display")
            };
            customizeBadgeSnapshots.set(image, snapshot);
        }

        const key = (Object.keys(customizeOriginalBadgeImages) as ExperimentalBadgeKey[])
            .find(candidate => snapshot!.src === customizeOriginalBadgeImages[candidate]);
        const replacedByFake = !!(
            key && settings.store.badgesEnabled && settings.store[key]
        );
        const shouldHide = !!settings.store.hideAllOriginalBadges || replacedByFake;

        if (shouldHide) container.style.setProperty("display", "none", "important");
        else if (snapshot.display) container.style.setProperty("display", snapshot.display, snapshot.displayPriority);
        else container.style.removeProperty("display");
    }

    // Only show previews for badges that are actually switched on in the
    // FakeBadges settings. Remove stale previews immediately when toggled off.
    const activeItems = getActiveFakeBadgeCatalog();
    const activeKeys = new Set(activeItems.map(item => item.key));
    panel.querySelectorAll<HTMLElement>("[data-fakebadges-catalog]").forEach(node => {
        const key = node.getAttribute("data-fakebadges-catalog");
        if (!key || !activeKeys.has(key)) node.remove();
    });

    // Clone Discord's own tile markup for consistent appearance.
    const template = panel.querySelector<HTMLElement>(".badgeTileContainer_i44TZ4:not([data-fakebadges-catalog])");
    if (!template) return;

    for (const item of activeItems) {
        const selector = `[data-fakebadges-catalog="${item.key}"]`;
        let clone = panel.querySelector<HTMLElement>(selector);
        if (!clone) {
            clone = template.cloneNode(true) as HTMLElement;
            clone.querySelectorAll<HTMLElement>("[id]").forEach(node => node.removeAttribute("id"));
            clone.removeAttribute("id");
            clone.setAttribute("data-fakebadges-catalog", item.key);
            clone.setAttribute("data-fakebadges-local-only", "true");
            clone.style.pointerEvents = "auto";
            panel.appendChild(clone);
        }

        clone.setAttribute("title", `${item.name} (FakeBadges — local preview)`);
        clone.style.removeProperty("display");
        clone.style.removeProperty("visibility");
        const icon = clone.querySelector<HTMLImageElement>("img.badgeTileIcon_i44TZ4, img");
        if (icon) {
            icon.src = item.image;
            icon.alt = item.name;
            icon.setAttribute("aria-label", item.name);
        }
        const tile = clone.querySelector<HTMLElement>(".badgeTile_i44TZ4");
        if (tile) {
            tile.setAttribute("aria-label", item.name);
            tile.setAttribute("title", `${item.name} (local preview)`);
            tile.setAttribute("tabindex", "0");
            tile.setAttribute("role", "button");
            tile.style.cursor = "pointer";
        }
    }

    for (const [image] of customizeBadgeSnapshots) {
        if (!image.isConnected) customizeBadgeSnapshots.delete(image);
    }
}


// Experimental badge details are rendered locally. Discord does not expose a
// public API for opening its internal detail panel for a client-only badge, so
// this lightweight panel mirrors its information hierarchy without changing
// Discord's React state or native badge records.
const experimentalDetailData: Record<ExperimentalBadgeKey, { description: string; milestones: string[] }> = {
    accountAge: {
        description: "Keep an active Discord account to level up this badge. Time will do the rest.",
        milestones: ["Seed — 1 year", "Sprout — 2 years", "Sapling — 3 years", "Bud — 4 years", "Blossom — 5 years", "Redwood — 6 years", "Sequoia — 7 years", "Bristlecone — 8 years", "Stromatolite — 9 years", "Primordial — 10+ years"]
    },
    gameTime: {
        description: "Play more hours of detectable PC games with Discord open to level up this badge.",
        milestones: ["Casual — 1 hour", "Recreational — 5 hours", "Dedicated — 20 hours", "Committed — 75 hours", "Serious — 150 hours", "Devoted — 300 hours", "Seasoned — 500 hours", "Ironclad — 1,000 hours", "Unshakeable — 2,000 hours", "Eternal — 5,000+ hours"]
    },
    gameVariety: {
        description: "Play more unique detectable games with Discord open to level up this badge.",
        milestones: [...levelLabels.gameVariety]
    },
    streamingTime: {
        description: "Stream more hours to other users to level up this badge.",
        milestones: ["Newcomer — 1 hour", "Fledgling — 5 hours", "Breakout — 20 hours", "Standout — 75 hours", "Trendsetter — 150 hours", "Headliner — 300 hours", "Star — 500 hours", "Sensation — 1,000 hours", "Visionary — 2,000 hours", "Phenomenon — 5,000+ hours"]
    }
};

let detailClickHandler: ((event: MouseEvent) => void) | undefined;
let detailKeyHandler: ((event: KeyboardEvent) => void) | undefined;
let activeDetailOverlay: HTMLElement | undefined;

function closeExperimentalBadgeDetails() {
    activeDetailOverlay?.remove();
    activeDetailOverlay = undefined;
}

function openExperimentalBadgeDetails(key: ExperimentalBadgeKey) {
    closeExperimentalBadgeDetails();
    const selectedLevel = (settings.store as any)[`${key}Level`] as string;
    const selectedIndex = Math.max(0, levels[key].indexOf(selectedLevel as never));
    const definition = experimentalBadges[key];
    const detail = experimentalDetailData[key];
    const overlay = document.createElement("div");
    overlay.setAttribute("data-fakebadges-detail", "true");
    overlay.style.cssText = "position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.68);backdrop-filter:blur(3px);";

    const panel = document.createElement("section");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", `${definition.name} badge details`);
    panel.style.cssText = "position:relative;box-sizing:border-box;width:min(520px,100%);max-height:min(760px,90vh);overflow:auto;border-radius:12px;background:var(--background-primary,#313338);color:var(--text-normal,#dbdee1);padding:24px;font-family:var(--font-primary,Arial,sans-serif);box-shadow:0 8px 32px rgba(0,0,0,.45);";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    close.style.cssText = "position:absolute;right:16px;top:12px;border:0;background:transparent;color:var(--interactive-normal,#b5bac1);font-size:28px;cursor:pointer;";
    close.addEventListener("click", closeExperimentalBadgeDetails);

    const eyebrow = document.createElement("div");
    eyebrow.textContent = "BADGE DETAILS · LOCAL PREVIEW";
    eyebrow.style.cssText = "font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted,#949ba4);margin:2px 40px 18px 0;";

    const hero = document.createElement("div");
    hero.style.cssText = "display:flex;align-items:center;gap:18px;margin-bottom:20px;";
    const art = document.createElement("img");
    art.src = definition.image(selectedLevel);
    art.alt = `${definition.name} ${levelDisplayNames[key][selectedLevel] ?? selectedLevel}`;
    art.style.cssText = "width:88px;height:88px;object-fit:contain;flex:none;";
    const identity = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = definition.name;
    title.style.cssText = "font-size:20px;font-weight:700;margin-bottom:6px;color:var(--header-primary,#f2f3f5);";
    const tier = document.createElement("div");
    tier.textContent = levelDisplayNames[key][selectedLevel] ?? selectedLevel;
    tier.style.cssText = "font-size:15px;color:var(--text-muted,#b5bac1);";
    identity.append(title, tier);
    hero.append(art, identity);

    const descriptionCard = document.createElement("div");
    descriptionCard.style.cssText = "background:var(--background-secondary,#2b2d31);border-radius:8px;padding:16px;margin-bottom:18px;";
    const descriptionTitle = document.createElement("div");
    descriptionTitle.textContent = "How to earn this badge";
    descriptionTitle.style.cssText = "font-weight:700;margin-bottom:8px;color:var(--header-primary,#f2f3f5);";
    const description = document.createElement("div");
    description.textContent = detail.description;
    description.style.cssText = "font-size:14px;line-height:1.45;color:var(--text-normal,#dbdee1);";
    descriptionCard.append(descriptionTitle, description);

    const progressHeading = document.createElement("div");
    progressHeading.textContent = "Selected tier";
    progressHeading.style.cssText = "font-weight:700;font-size:14px;margin:0 0 10px;color:var(--header-primary,#f2f3f5);";
    const progress = document.createElement("div");
    progress.style.cssText = "height:6px;border-radius:99px;background:var(--background-modifier-accent,#4e5058);overflow:hidden;margin-bottom:8px;";
    const fill = document.createElement("div");
    fill.style.cssText = `height:100%;width:${Math.round(((selectedIndex + 1) / detail.milestones.length) * 100)}%;background:var(--brand-500,#5865f2);border-radius:99px;`;
    progress.appendChild(fill);
    const progressNote = document.createElement("div");
    progressNote.textContent = `Tier ${selectedIndex + 1} of ${detail.milestones.length} · This is a local level selection, not server-verified progress.`;
    progressNote.style.cssText = "font-size:12px;color:var(--text-muted,#949ba4);margin-bottom:20px;";

    const timelineHeading = document.createElement("div");
    timelineHeading.textContent = "Badge levels";
    timelineHeading.style.cssText = "font-weight:700;font-size:14px;margin-bottom:10px;color:var(--header-primary,#f2f3f5);";
    const timeline = document.createElement("div");
    timeline.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;";
    detail.milestones.forEach((milestone, index) => {
        const item = document.createElement("div");
        item.textContent = `${index + 1}. ${milestone}`;
        item.style.cssText = `box-sizing:border-box;padding:9px 10px;border-radius:6px;background:${index === selectedIndex ? "var(--background-modifier-selected,#404675)" : "var(--background-secondary,#2b2d31)"};font-size:12px;line-height:1.35;color:${index === selectedIndex ? "var(--header-primary,#fff)" : "var(--text-normal,#dbdee1)"};font-weight:${index === selectedIndex ? "700" : "400"};`;
        timeline.appendChild(item);
    });

    panel.append(close, eyebrow, hero, descriptionCard, progressHeading, progress, progressNote, timelineHeading, timeline);
    overlay.appendChild(panel);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeExperimentalBadgeDetails(); });
    document.body.appendChild(overlay);
    activeDetailOverlay = overlay;
    close.focus();
}

function installExperimentalDetailHandlers() {
    if (typeof document === "undefined" || detailClickHandler) return;
    detailClickHandler = event => {
        const target = event.target as HTMLElement | null;
        const tile = target?.closest<HTMLElement>("[data-fakebadges-catalog]");
        if (!tile) return;
        const key = tile.getAttribute("data-fakebadges-catalog") as ExperimentalBadgeKey;
        if (!key || !(key in experimentalBadges)) return;
        event.preventDefault();
        event.stopPropagation();
        openExperimentalBadgeDetails(key);
    };
    detailKeyHandler = event => {
        if (event.key === "Escape") closeExperimentalBadgeDetails();
        if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLElement) {
            const tile = event.target.closest<HTMLElement>("[data-fakebadges-catalog]");
            const key = tile?.getAttribute("data-fakebadges-catalog") as ExperimentalBadgeKey | null;
            if (key && key in experimentalBadges) {
                event.preventDefault();
                openExperimentalBadgeDetails(key);
            }
        }
    };
    document.addEventListener("click", detailClickHandler, true);
    document.addEventListener("keydown", detailKeyHandler, true);
}

function uninstallExperimentalDetailHandlers() {
    if (detailClickHandler) document.removeEventListener("click", detailClickHandler, true);
    if (detailKeyHandler) document.removeEventListener("keydown", detailKeyHandler, true);
    detailClickHandler = undefined;
    detailKeyHandler = undefined;
    closeExperimentalBadgeDetails();
}

function installOriginalBadgeFilter() {
    if (typeof document === "undefined" || badgeObserver) return;

    syncOriginalBadges();
    syncBadgeDirectory();
    syncCustomizeBadgesPanel();
    badgeObserver = new MutationObserver(() => {
        syncOriginalBadges();
        syncBadgeDirectory();
        syncCustomizeBadgesPanel();
    });
    badgeObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function uninstallOriginalBadgeFilter() {
    badgeObserver?.disconnect();
    badgeObserver = undefined;

    for (const anchor of hiddenOriginalBadges.keys()) restoreOriginalBadge(anchor);
    hiddenOriginalBadges.clear();

    for (const [slot, snapshot] of directoryBadgeSnapshots) {
        const image = slot.querySelector<HTMLImageElement>("img");
        if (image) {
            if (snapshot.imageSrc == null) image.removeAttribute("src");
            else image.setAttribute("src", snapshot.imageSrc);
        }
        if (snapshot.ariaLabel == null) slot.removeAttribute("aria-label");
        else slot.setAttribute("aria-label", snapshot.ariaLabel);
        if (snapshot.display) slot.style.setProperty("display", snapshot.display, snapshot.displayPriority);
        else slot.style.removeProperty("display");
    }
    directoryBadgeSnapshots.clear();

    for (const [image, snapshot] of customizeBadgeSnapshots) {
        if (snapshot.src == null) image.removeAttribute("src");
        else image.setAttribute("src", snapshot.src);
        if (snapshot.display) snapshot.container.style.setProperty("display", snapshot.display, snapshot.displayPriority);
        else snapshot.container.style.removeProperty("display");
    }
    customizeBadgeSnapshots.clear();

    document.querySelectorAll('[data-fakebadges-local-only="true"]').forEach(node => node.remove());
}

// Remove every badge previously registered by this plugin before rebuilding
// the list. This is required when a switch or level selector changes.
function clearBadges() {
    for (const badge of equippedBadges.values()) {
        removeProfileBadge(badge);
    }
    equippedBadges.clear();
}

refreshBadges = function () {
    clearBadges();
    syncOriginalBadges();
    syncBadgeDirectory();
    syncCustomizeBadgesPanel();
    if (!settings.store.badgesEnabled) return;

    const userId = currentUserId ?? UserStore.getCurrentUser()?.id;
    if (!userId) return;

    for (const key of Object.keys(badgeDefinitions) as LegacyBadgeKey[]) {
        if (!settings.store[key]) continue;
        const definition = badgeDefinitions[key];
        const badge: ProfileBadge = {
            id: `fake-badges-${key}`,
            description: definition.name,
            iconSrc: `https://cdn.discordapp.com/badge-icons/${definition.hash}.png`,
            position: BadgePosition.END,
            shouldShow: ({ userId: targetId }) => targetId === userId
        };
        equippedBadges.set(key, badge);
        addProfileBadge(badge);
    }

    for (const key of Object.keys(experimentalBadges) as ExperimentalBadgeKey[]) {
        if (!settings.store[key]) continue;
        const definition = experimentalBadges[key];
        const selectedLevel = (settings.store as any)[`${key}Level`] as string;
        const badge: ProfileBadge = {
            id: `fake-badges-${key}`,
            description: `${definition.name} — ${levelDisplayNames[key][selectedLevel] ?? selectedLevel}`,
            iconSrc: definition.image(selectedLevel),
            position: BadgePosition.END,
            shouldShow: ({ userId: targetId }) => targetId === userId
        };
        equippedBadges.set(key, badge);
        addProfileBadge(badge);
    }

    syncOriginalBadges();
    syncBadgeDirectory();
    syncCustomizeBadgesPanel();
};

function FakeBadgesSettingsControls() {
    const [badgesEnabled, setBadgesEnabled] = useState(!!settings.store.badgesEnabled);
    const [hideAll, setHideAll] = useState(!!settings.store.hideAllOriginalBadges);
    const [, forceUpdate] = useState(0);

    const descriptions: Record<string, string> = {
        staff: "Insignia clásica del equipo de Discord.",
        partner: "Reconocimiento para comunidades asociadas con Discord.",
        hypesquad: "Insignia de participación en HypeSquad Events.",
        bugHunter: "Reconocimiento por reportes de errores.",
        bugHunterGold: "Nivel avanzado del programa Bug Hunter.",
        earlySupporter: "Insignia para los primeros colaboradores de Discord.",
        verifiedDeveloper: "Reconocimiento para desarrolladores de bots verificados.",
        activeDeveloper: "Insignia del programa Active Developer.",
        nitro: "Insignia de suscripción a Discord Nitro.",
        nitro1Month: "Antigüedad Nitro: 1 mes.",
        nitro3Months: "Antigüedad Nitro: 3 meses.",
        nitro6Months: "Antigüedad Nitro: 6 meses.",
        nitro1Year: "Antigüedad Nitro: 1 año.",
        nitro2Years: "Antigüedad Nitro: 2 años.",
        nitro3Years: "Antigüedad Nitro: 3 años.",
        nitro5Years: "Antigüedad Nitro: 5 años.",
        nitro6Years: "Antigüedad Nitro: 6 años.",
        accountAge: "Personaliza el nivel que aparece para la antigüedad de tu cuenta.",
        gameTime: "Selecciona el nivel visual de tiempo jugando.",
        gameVariety: "Personaliza la insignia de variedad de juegos.",
        streamingTime: "Selecciona el nivel visual de tiempo transmitiendo."
    };

    const legacyGroups: Array<{ title: string; subtitle: string; keys: LegacyBadgeKey[] }> = [
        {
            title: "Insignias clásicas",
            subtitle: "Insignias conocidas de Discord",
            keys: ["staff", "partner", "hypesquad", "bugHunter", "bugHunterGold", "earlySupporter", "verifiedDeveloper", "activeDeveloper"]
        },
        {
            title: "Discord Nitro",
            subtitle: "Insignias y antigüedad de suscripción",
            keys: ["nitro", "nitro1Month", "nitro3Months", "nitro6Months", "nitro1Year", "nitro2Years", "nitro3Years", "nitro5Years", "nitro6Years"]
        }
    ];

    const experimentalKeys: ExperimentalBadgeKey[] = ["accountAge", "gameTime", "gameVariety", "streamingTime"];
    const h = React.createElement;

    const updateBadge = (key: BadgeKey, enabled: boolean) => {
        (settings.store as any)[key] = enabled;
        refreshBadges();
        forceUpdate(value => value + 1);
    };

    const updateLevel = (key: ExperimentalBadgeKey, level: string) => {
        (settings.store as any)[`${key}Level`] = level;
        refreshBadges();
        forceUpdate(value => value + 1);
    };

    const toggleBadges = () => {
        const next = !settings.store.badgesEnabled;
        settings.store.badgesEnabled = next;
        setBadgesEnabled(next);
        refreshBadges();
    };

    const toggleOriginals = () => {
        const next = !settings.store.hideAllOriginalBadges;
        settings.store.hideAllOriginalBadges = next;
        setHideAll(next);
        syncOriginalBadges();
        syncBadgeDirectory();
        syncCustomizeBadgesPanel();
        forceUpdate(value => value + 1);
    };

    const badgeImage = (key: BadgeKey) => {
        if (key in badgeDefinitions) {
            return `https://cdn.discordapp.com/badge-icons/${badgeDefinitions[key as LegacyBadgeKey].hash}.png`;
        }
        const experimentalKey = key as ExperimentalBadgeKey;
        const selected = (settings.store as any)[`${experimentalKey}Level`] as string;
        return experimentalBadges[experimentalKey].image(selected);
    };

    const makeSwitch = (checked: boolean, label: string, onClick: () => void) =>
        h("button", {
            type: "button",
            className: `fb-switch${checked ? " fb-switch-on" : ""}`,
            role: "switch",
            "aria-checked": checked,
            "aria-label": label,
            onClick
        }, h("span", { className: "fb-switch-thumb" }));

    const makeBadgeCard = (key: BadgeKey) => {
        const isExperimental = experimentalKeys.includes(key as ExperimentalBadgeKey);
        const selected = !!(settings.store as any)[key];
        const active = badgesEnabled && selected;
        const name = isExperimental
            ? experimentalBadges[key as ExperimentalBadgeKey].name
            : badgeDefinitions[key as LegacyBadgeKey].name;
        const levelKey = key as ExperimentalBadgeKey;
        const selectedLevel = isExperimental ? (settings.store as any)[`${key}Level`] as string : "";
        const currentLevelLabel = isExperimental
            ? levelDisplayNames[levelKey][selectedLevel] ?? selectedLevel
            : "";
        const levelIndex = isExperimental ? levels[levelKey].indexOf(selectedLevel as never) : -1;

        const children: any[] = [
            h("div", { className: "fb-card-top", key: "top" },
                h("div", { className: "fb-badge-art-wrap" },
                    h("img", { className: "fb-badge-art", src: badgeImage(key), alt: name, loading: "lazy" })
                ),
                h("div", { className: "fb-card-identity" },
                    h("div", { className: "fb-card-title" }, name),
                    h("div", { className: "fb-card-description" }, descriptions[key]),
                    h("div", { className: `fb-status${active ? " fb-status-active" : ""}` },