import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { ConversationModel, LiveTurn, Turn } from '../lib/conversation.ts';
import { count, type Copy } from '../theme/copy';
import { usePalette, useTheme } from '../theme/ThemeProvider';
import {
  content,
  family,
  familyFor,
  radius,
  space,
  type as typeScale,
} from '../theme/tokens';

type TranscriptProps = {
  conversation: ConversationModel;
  language: string;
  refusal: string | null;
  copy: Copy;
  /** Index of the sentence being spoken, for the haptic tick. */
  onSentenceSpoken: (index: number) => number;
};

/** How close to the bottom still counts as "following", in dp. */
const FOLLOW_SLACK = 48;

export function Transcript({
  conversation,
  language,
  refusal,
  copy,
  onSentenceSpoken,
}: TranscriptProps) {
  const scrollRef = useRef<FlatList<Turn>>(null);
  const reducedMotion = useReducedMotion();
  const familyForLanguage = familyFor(language);
  const speakingWeight: '400' | '600' = language === 'brx' ? '600' : '400';
  const theme = useTheme();
  const palette = usePalette();
  const accent = theme.accent(language);

  /** Whether the view is pinned to the newest content. */
  const followingRef = useRef(true);
  const draggingRef = useRef(false);
  const [following, setFollowing] = useState(true);
  /** Bumped whenever new content arrives, which is what re-triggers the follow. */
  const [tail, setTail] = useState(0);

  const turns = conversation.history.length + (conversation.live ? 1 : 0);
  const contentKey = `${turns}:${conversation.live?.segments.length ?? 0}:${
    conversation.live?.said.length ?? 0
  }`;

  // Follow the newest turn, but only while the user has not scrolled away from it.
  useEffect(() => {
    setTail((value) => value + 1);
  }, [contentKey]);

  useEffect(() => {
    if (!following) return;
    scrollRef.current?.scrollToEnd({ animated: !reducedMotion });
  }, [following, tail, reducedMotion]);

  const onScroll = useCallback((offset: number, height: number, content: number) => {
    if (!draggingRef.current) return;
    const distance = content - (offset + height);
    const atBottom = distance <= FOLLOW_SLACK;
    if (followingRef.current !== atBottom) {
      followingRef.current = atBottom;
      setFollowing(atBottom);
    }
  }, []);

  const liveSpeaking = conversation.live?.segments.findIndex(
    (segment) => segment.state === 'speaking',
  );
  useEffect(() => {
    if (liveSpeaking === undefined || liveSpeaking < 0) return;
    onSentenceSpoken(liveSpeaking);
  }, [liveSpeaking, conversation.live?.key, onSentenceSpoken]);


  return (
    <View style={styles.root}>
      {!following ? (
        <PressableToNewest onPress={() => {
          followingRef.current = true;
          setFollowing(true);
          scrollRef.current?.scrollToEnd({ animated: !reducedMotion });
        }} count={turns} accent={accent.tint} />
      ) : null}

      <FlatList
        ref={scrollRef}
        data={conversation.history}
        keyExtractor={(turn) => turn.key}
        renderItem={({ item, index }) => (
          <TurnBlock turn={item} number={index + 1} family={familyForLanguage}
            speakingWeight={speakingWeight} accent={accent.tint}
            saidAccent={accent.resting} copy={copy} />
        )}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => {
          if (followingRef.current) scrollRef.current?.scrollToEnd({ animated: false });
        }}
        onScroll={(event) => onScroll(event.nativeEvent.contentOffset.y,
          event.nativeEvent.layoutMeasurement.height, event.nativeEvent.contentSize.height)}
        onScrollBeginDrag={() => { draggingRef.current = true; }}
        onScrollEndDrag={(event) => { if (!event.nativeEvent.velocity?.y) draggingRef.current = false; }}
        onMomentumScrollEnd={() => { draggingRef.current = false; }}
        scrollEventThrottle={64}
        showsVerticalScrollIndicator
        ListFooterComponent={<View style={styles.footer}>
        {conversation.live ? (
          <TurnBlock
            turn={conversation.live}
            number={conversation.history.length + 1}
            family={familyForLanguage}
            speakingWeight={speakingWeight}
            accent={accent.tint}
            saidAccent={accent.resting}
            copy={copy}
            live
          />
        ) : null}

        {refusal ? <Notice colour={palette.text.withheld} label={copy.withheld} /> : null}
        </View>}
      />
    </View>
  );
}

/** The affordance that appears when the user has scrolled away from the newest turn. */
function PressableToNewest({
  onPress,
  count: turns,
  accent,
}: {
  onPress: () => void;
  count: number;
  accent: string;
}) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Jump to latest reply"
      onPress={onPress} style={[styles.jump, { borderColor: palette.hairline.strong, backgroundColor: palette.surface.raised }]}>
      <Text style={[typeScale.caption, { fontFamily: family.mono, color: accent }]}>↓ Latest reply · {turns}</Text>
    </Pressable>
  );
}

function TurnBlock({
  turn,
  number,
  family: body,
  speakingWeight,
  accent,
  saidAccent,
  copy,
  live = false,
}: {
  turn: Turn | LiveTurn;
  number: number;
  family: string;
  speakingWeight: '400' | '600';
  accent: string;
  saidAccent: string;
  copy: Copy;
  live?: boolean;
}) {
  const palette = usePalette();
  return (
    <View style={styles.turn}>
      <View style={styles.turnHead}>
        <Text style={[styles.turnTag, { color: accent }]}>{copy.eyebrowYou}</Text>
        <View style={[styles.turnRule, { backgroundColor: palette.hairline.faint }]} />
        <Text style={[styles.turnNumber, { color: palette.text.faint }]}>{count(number)}</Text>
      </View>

      {turn.said ? (
        // The user's own words are set apart from the reply by a rule, not only by colour.
        // Colour alone was not enough: the agent's discarded sentences are dimmed too, so an
        // interrupted turn made the two indistinguishable and the user could no longer tell
        // which half of the exchange had been thrown away. A rule is a shape, and a shape
        // survives a dimmed screen and a greyscale screenshot.
        <View style={[styles.saidBlock, { borderLeftColor: saidAccent }]}>
          <Text
            selectable
            style={[
              styles.said,
              { fontFamily: body, includeFontPadding: content.padAscender, color: palette.text.body },
            ]}
          >
            {turn.said}
          </Text>
        </View>
      ) : null}

      {turn.segments.length > 0 ? (
        <View style={styles.reply}>
          <Text style={[styles.turnTag, { fontFamily: family.mono, color: palette.text.muted }]}>{copy.eyebrowMiithii}</Text>
          {turn.segments.some((segment) => segment.state === 'unspoken') ? (
            <Text style={[typeScale.eyebrow, { fontFamily: family.mono, color: palette.text.muted }]}>{copy.interrupted}</Text>
          ) : null}
          {live && turn.segments.some((segment) => segment.state === 'pending') ? (
            <Text style={[typeScale.eyebrow, { fontFamily: family.mono, color: palette.text.muted }]}>{copy.generated}</Text>
          ) : null}
          <Text selectable style={[typeScale.reply, { fontFamily: body, includeFontPadding: content.padAscender, color: palette.text.body }]}>
            {turn.segments.map((segment, index) => <Text key={index} style={{
              color: segment.state === 'speaking' ? accent : segment.state === 'unspoken' || segment.state === 'pending' ? palette.text.muted : palette.text.body,
              backgroundColor: segment.state === 'speaking' ? palette.surface.controlPressed : 'transparent',
              fontWeight: segment.state === 'speaking' ? speakingWeight : '400',
            }}>{segment.text}{index < turn.segments.length - 1 ? ' ' : ''}</Text>)}
          </Text>
        </View>
      ) : live ? (
        <Text style={[styles.waiting, { fontFamily: body, color: palette.text.absent }]}>…</Text>
      ) : null}
    </View>
  );
}

function Notice({ colour, label }: { colour: string; label: string }) {
  return (
    <View style={[styles.notice, { borderColor: colour }]}>
      <Text style={[styles.noticeText, { color: colour }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  footer: { gap: space.xl },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.xl,
  },

  // A turn. The head is a technical rule with the turn number on the right, which is what makes
  // a long conversation navigable instead of one undifferentiated wall.
  turn: {
    gap: space.sm,
  },
  turnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  turnTag: {
    ...typeScale.eyebrow,
    fontFamily: family.mono,
  },
  turnRule: {
    flex: 1,
    height: 1,
  },
  turnNumber: {
    ...typeScale.eyebrow,
  },

  said: {
    ...typeScale.said,
  },
  saidBlock: {
    borderLeftWidth: 1,
    paddingLeft: space.md,
  },
  reply: {
    gap: space.xs,
  },
  waiting: {
    ...typeScale.reply,
  },

  notice: {
    borderLeftWidth: 1,
    paddingLeft: space.md,
  },
  noticeText: {
    ...typeScale.caption,
    fontFamily: family.mono,
  },

  jump: {
    position: 'absolute',
    right: space.xl,
    bottom: space.md,
    zIndex: 2,
    ...typeScale.eyebrow,
    fontFamily: family.mono,
    paddingHorizontal: space.md,
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    borderRadius: radius.control,
  },
});
