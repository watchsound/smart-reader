/* eslint-disable prettier/prettier */
import { CardContent, CardMedia } from '@mui/material';
import { styled } from '@mui/material/styles';

import { CardType } from '../../../commons/model/Note';
import MyMindMap from '../mindmap';
import CardContentPanel from '../cardsetting/CardContentPanel';
import FlipCard from '../FlipCard';

const Container = styled(CardContent)({
  position: 'relative',
  margin: 'auto',
  padding: '2px',
});

const FullImage = styled('img')({
  width: '100%',
  height: '100%',
});
const FullWidthImage = styled('img')({
  width: '100%',
  height: 'auto',
});
const TextOverlay = styled('div')({
  position: 'absolute',
  left: 0,
  right: 0,
  width: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.33)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 16,
  boxSizing: 'border-box',
});
const TextOverlayTop = styled(TextOverlay)({
  top: 0,
});
const TextOverlayBottom = styled(TextOverlay)({
  bottom: 0,
});
const TextOverlayMiddle = styled(TextOverlay)({
  top: '50%',
  transform: 'translateY(-50%)',
});

function CardContentSwitcherNormal({
  imageCode,
  cardType,
  title,
  cardDatum,
  cardWidth,
  cardHeight,
  useMiniHeight,
  entryEffect,
  emphasisEffect,
}) {
  const adjustHeight = 0; // isMoodBoard ? (title ? 50 : 90) : 0;
  if (cardType === CardType.MindMap) {
    const { data } = cardDatum;
    if (!data) return null;
    if (!imageCode) {
      return (
        <CardContent
          sx={{
            margin: '2px',
            width: '100%',
            padding: '2px',
            height: useMiniHeight ? undefined : '100%',
            miniHeight: useMiniHeight ?  cardHeight : undefined,
          }}
        >
          <MyMindMap
            keywordMap={data.keywordMap}
            descriptionMap={data.descriptionMap}
          />
        </CardContent>
      );
    }
      return (
        <Container
          sx={{
            margin: '0px',
            overflowY: 'auto',
            width: cardWidth,
            height: useMiniHeight ? undefined : cardHeight,
            miniHeight: useMiniHeight ?  cardHeight : undefined,
          }}
        >
          <FullImage src={imageCode} />
          <TextOverlayBottom>
            <MyMindMap
              keywordMap={data.keywordMap}
              descriptionMap={data.descriptionMap}
            />
          </TextOverlayBottom>
        </Container>
      );
  }
  const w = cardWidth;
  const h = cardHeight; // parseInt(cardHeight) + adjustHeight - 100;
  return (
    <CardContent
        sx={{
          margin: '2px',
          overflowY: 'auto',
          padding: '2px',
          width: w,
          height: useMiniHeight ? undefined : h,
          miniHeight: useMiniHeight ?  h : undefined,
        }}
      >
        <CardContentPanel entryEffect={entryEffect} useMiniHeight={useMiniHeight}
           emphasisEffect={emphasisEffect} cardData={cardDatum}  cardTitle={title} imageSrc={imageCode} width={w-8} height={h-8}  />
      </CardContent>
  );
}

function CardContentSwitcher({
  imageCodes,
  cardTypes,
  title,
  cardDatums,
  selectedSide,
  cardWidth,
  cardHeight,
  useMiniHeight,
  entryEffect,
  emphasisEffect,
}) {

  const hasMindMap = cardTypes.indexOf(CardType.MindMap) >= 0;
  if (useMiniHeight || hasMindMap || cardDatums.length <= 1 ) {
    const imageCode = imageCodes[selectedSide];
    const cardType = cardTypes[selectedSide];
    const cardDatum = cardDatums[selectedSide];
    return CardContentSwitcherNormal({
      imageCode,
      cardType,
      title,
      cardDatum,
      cardWidth,
      cardHeight,
      useMiniHeight,
      entryEffect,
      emphasisEffect,
    });
  }
  // const adjustHeight = 0; // isMoodBoard ? (title ? 50 : 90) : 0;
  const w = cardWidth;
  const h = cardHeight; // parseInt(cardHeight) + adjustHeight; // - 100;

  const pages = [];
  cardDatums.forEach( (m, index) => {
     pages.push(
      <CardContent
        key={index}
        sx={{
          margin: '2px',
          overflowY: 'auto',
          width: '100%',
          height: '100%',
          padding: '2px',
        }}
      >
        <CardContentPanel entryEffect={entryEffect} useMiniHeight={false}
           emphasisEffect={emphasisEffect} cardData={m}  cardTitle={title} imageSrc={imageCodes[index]} width={w-8} height={h-8}  />
     </CardContent>
      );
  });

  return (
     <FlipCard cards={pages}  width={w} height={h} curCardIndex={selectedSide}/>
  );

}


export default CardContentSwitcher;
