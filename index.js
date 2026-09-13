require("dotenv").config();

const http = require("node:http");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const requiredEnv = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "GUILD_ID",
  "TICKET_CATEGORY_ID",
  "SUPPORT_ROLE_ID",
  "VERIFIED_ROLE_ID",
  "VOUCH_CHANNEL_ID",
];

const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Fehlende Umgebungsvariablen: ${missing.join(", ")}`);
  process.exit(1);
}

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  supportRoleId: process.env.SUPPORT_ROLE_ID,
  verifiedRoleId: process.env.VERIFIED_ROLE_ID,
  vouchChannelId: process.env.VOUCH_CHANNEL_ID,
  brand: process.env.BRAND_NAME || "Community Support",
};

const commands = [
  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Postet das Ticket-Panel in diesen Kanal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("verify-panel")
    .setDescription("Postet das Verify-Panel in diesen Kanal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("news")
    .setDescription("Postet eine News-Nachricht")
    .addStringOption((option) =>
      option.setName("titel").setDescription("Titel der News").setRequired(true).setMaxLength(256),
    )
    .addStringOption((option) =>
      option.setName("text").setDescription("Inhalt der News").setRequired(true).setMaxLength(4000),
    )
    .addChannelOption((option) =>
      option
        .setName("kanal")
        .setDescription("Zielkanal (Standard: aktueller Kanal)")
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((option) =>
      option.setName("bild").setDescription("Optionaler direkter Bild-Link"),
    )
    .addStringOption((option) =>
      option.setName("ping").setDescription("Optional: z. B. @everyone oder eine Rollen-Erwähnung"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName("vouch")
    .setDescription("Gibt eine Bewertung ab")
    .addUserOption((option) =>
      option.setName("user").setDescription("Bewerteter Discord-Nutzer").setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("sterne")
        .setDescription("Bewertung von 1 bis 5 Sternen")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5),
    )
    .addStringOption((option) =>
      option.setName("text").setDescription("Deine Erfahrung").setRequired(true).setMaxLength(1500),
    )
    .addStringOption((option) =>
      option.setName("bild_link").setDescription("Optionaler Link zu einem Beweisbild"),
    ),
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Verwaltet das aktuelle Ticket")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Fügt einen Nutzer zum Ticket hinzu")
        .addUserOption((option) => option.setName("user").setDescription("Nutzer").setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Entfernt einen Nutzer aus dem Ticket")
        .addUserOption((option) => option.setName("user").setDescription("Nutzer").setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("close").setDescription("Schließt das aktuelle Ticket"),
    ),
].map((command) => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const port = Number(process.env.PORT || 3000);
const healthServer = http.createServer((request, response) => {
  response.writeHead(request.url === "/health" ? 200 : 200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(client.isReady() ? "Bot online" : "Bot startet");
});

healthServer.listen(port, "0.0.0.0", () => {
  console.log(`Health-Server läuft auf Port ${port}`);
});

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ticketOwnerId(channel) {
  const match = channel.topic?.match(/ticket-owner:(\d+)/);
  return match?.[1] || null;
}

function isTicketChannel(channel) {
  return channel?.type === ChannelType.GuildText && Boolean(ticketOwnerId(channel));
}

function canManageTicket(interaction) {
  return (
    interaction.member.roles.cache.has(config.supportRoleId) ||
    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

async function closeTicket(interaction) {
  if (!isTicketChannel(interaction.channel)) {
    return interaction.reply({ content: "Dieser Befehl funktioniert nur in einem Ticket.", ephemeral: true });
  }

  const ownerId = ticketOwnerId(interaction.channel);
  if (interaction.user.id !== ownerId && !canManageTicket(interaction)) {
    return interaction.reply({ content: "Du darfst dieses Ticket nicht schließen.", ephemeral: true });
  }

  await interaction.reply("🔒 Dieses Ticket wird in 5 Sekunden geschlossen.");
  setTimeout(() => {
    interaction.channel.delete(`Ticket geschlossen von ${interaction.user.tag}`).catch(console.error);
  }, 5000);
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
}

client.once("ready", async () => {
  console.log(`Eingeloggt als ${client.user.tag}`);
  try {
    await registerCommands();
    console.log("Slash-Commands wurden registriert.");
  } catch (error) {
    console.error("Slash-Commands konnten nicht registriert werden:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === "ticket:create") {
        const existing = interaction.guild.channels.cache.find(
          (channel) => ticketOwnerId(channel) === interaction.user.id,
        );
        if (existing) {
          return interaction.reply({ content: `Du hast bereits ein Ticket: ${existing}`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "user";
        const channel = await interaction.guild.channels.create({
          name: `ticket-${safeName}`,
          type: ChannelType.GuildText,
          parent: config.ticketCategoryId,
          topic: `ticket-owner:${interaction.user.id}`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
            {
              id: config.supportRoleId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
          ],
        });

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket:close")
            .setLabel("Ticket schließen")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger),
        );
        await channel.send({
          content: `${interaction.user} <@&${config.supportRoleId}>`,
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle("Support-Ticket")
              .setDescription("Beschreibe bitte dein Anliegen. Das Support-Team meldet sich so schnell wie möglich.")
              .setFooter({ text: config.brand })
              .setTimestamp(),
          ],
          components: [closeRow],
        });
        return interaction.editReply(`Dein Ticket wurde erstellt: ${channel}`);
      }

      if (interaction.customId === "ticket:close") return closeTicket(interaction);

      if (interaction.customId === "verify:claim") {
        if (interaction.member.roles.cache.has(config.verifiedRoleId)) {
          return interaction.reply({ content: "Du bist bereits verifiziert.", ephemeral: true });
        }
        await interaction.member.roles.add(config.verifiedRoleId, "Verifizierung per Verify-Button");
        return interaction.reply({ content: "✅ Du wurdest erfolgreich verifiziert.", ephemeral: true });
      }
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ticket-panel") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket:create")
          .setLabel("Ticket erstellen")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Primary),
      );
      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("Support")
            .setDescription("Du brauchst Hilfe? Klicke auf den Button und erstelle ein privates Ticket.")
            .setFooter({ text: config.brand }),
        ],
        components: [row],
      });
      return interaction.reply({ content: "Ticket-Panel wurde gepostet.", ephemeral: true });
    }

    if (interaction.commandName === "verify-panel") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("verify:claim")
          .setLabel("Verifizieren")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
      );
      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("Verifizierung")
            .setDescription("Klicke auf den Button, um Zugriff auf den Server zu erhalten.")
            .setFooter({ text: config.brand }),
        ],
        components: [row],
      });
      return interaction.reply({ content: "Verify-Panel wurde gepostet.", ephemeral: true });
    }

    if (interaction.commandName === "news") {
      const channel = interaction.options.getChannel("kanal") || interaction.channel;
      const image = interaction.options.getString("bild");
      if (!isHttpUrl(image)) {
        return interaction.reply({ content: "Der Bild-Link muss mit http:// oder https:// beginnen.", ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(interaction.options.getString("titel"))
        .setDescription(interaction.options.getString("text"))
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
        .setFooter({ text: config.brand })
        .setTimestamp();
      if (image) embed.setImage(image);
      await channel.send({
        content: interaction.options.getString("ping") || undefined,
        embeds: [embed],
        allowedMentions: { parse: ["everyone", "roles"] },
      });
      return interaction.reply({ content: `News wurde in ${channel} gepostet.`, ephemeral: true });
    }

    if (interaction.commandName === "vouch") {
      const target = interaction.options.getUser("user");
      const rating = interaction.options.getInteger("sterne");
      const proof = interaction.options.getString("bild_link");
      if (!isHttpUrl(proof)) {
        return interaction.reply({ content: "Der Bild-Link muss mit http:// oder https:// beginnen.", ephemeral: true });
      }
      const channel = await interaction.guild.channels.fetch(config.vouchChannelId);
      if (!channel?.isTextBased()) {
        return interaction.reply({ content: "Der konfigurierte Vouch-Kanal ist ungültig.", ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(rating >= 4 ? 0x57f287 : rating >= 3 ? 0xfee75c : 0xed4245)
        .setTitle(`${"⭐".repeat(rating)}${"☆".repeat(5 - rating)}`)
        .setDescription(interaction.options.getString("text"))
        .addFields(
          { name: "Bewerteter Nutzer", value: `${target} (${target.id})` },
          { name: "Bewertung von", value: `${interaction.user} (${interaction.user.id})` },
        )
        .setThumbnail(target.displayAvatarURL())
        .setFooter({ text: config.brand })
        .setTimestamp();
      if (proof) embed.setImage(proof);
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `Danke! Dein Vouch wurde in ${channel} gepostet.`, ephemeral: true });
    }

    if (interaction.commandName === "ticket") {
      if (!isTicketChannel(interaction.channel)) {
        return interaction.reply({ content: "Dieser Befehl funktioniert nur in einem Ticket.", ephemeral: true });
      }
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "close") return closeTicket(interaction);
      if (!canManageTicket(interaction) && interaction.user.id !== ticketOwnerId(interaction.channel)) {
        return interaction.reply({ content: "Du darfst dieses Ticket nicht verwalten.", ephemeral: true });
      }
      const user = interaction.options.getUser("user");
      if (subcommand === "add") {
        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        return interaction.reply(`✅ ${user} wurde zum Ticket hinzugefügt.`);
      }
      await interaction.channel.permissionOverwrites.delete(user.id);
      return interaction.reply(`✅ ${user} wurde aus dem Ticket entfernt.`);
    }
  } catch (error) {
    console.error(error);
    const payload = { content: "Es ist ein Fehler aufgetreten. Prüfe die Bot-Rechte und Konfiguration.", ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

client.login(config.token);
