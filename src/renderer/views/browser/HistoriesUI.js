/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Grid,
  Typography,
  Pagination,
  Divider,
  Paper,
  CardContent,
  CardMedia,
  Box,
  Avatar,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import customStorage from '../../store/customStorage';

const CustomCardContent = styled(CardContent)(({ theme }) => ({
  padding: 16,
  '&:last-child': {
    paddingBottom: '0px', // Override the default paddingBottom
  },
}));

function HistoryCard({ group, historyCallback }) {
  return (
    <Card
      style={{
        margin: '4px 1px',
        padding: '1px',
        width: '290px',
        paddingBottom: '1px',
      }}
    >
      <CustomCardContent>
        <Typography variant="h9" gutterBottom>
          {group[0].createdAt}
        </Typography>
        {group.map((history) => (
          <Box
            key={history.id}
            display="flex"
            alignItems="center"
            mb={1}
            onClick={() => historyCallback(history.sourceKey)}
            sx={{ margin: '1px', padding: '1px' }}
          >
            <Avatar
              src={history.favicon}
              alt="favicon"
              variant="rounded"
              sx={{ width: 24, height: 24, marginRight: '10px' }}
            />
            <Box>
              <Typography
                variant="h12"
                component="div"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  margin: '1px',
                  padding: '1px',
                  fontSize: '12px',
                }}
              >
                {history.description}
              </Typography>
              <Typography
                variant="h12"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  margin: '1px',
                  padding: '1px',
                  fontSize: '12px',
                }}
              >
                {history.sourceKey}
              </Typography>
            </Box>
          </Box>
        ))}
      </CustomCardContent>
    </Card>
  );
}

function HistoriesUI({ filterKey, historyCallback }) {
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [histories, setHistories] = useState([]);

  useEffect(() => {
    async function t() {
      const result = await customStorage.getHistoryByQuery(
        'url',
        filterKey || '',
        page,
        limit,
      );
      if (result.data && result.data.length > 0) {
        const r = [];
        let curGroup = [result.data[0]];
        r.push(curGroup);
        for (let i = 1; i < result.data.length; i++) {
          const cd = result.data[i];
          if (cd.groupId === curGroup[0].groupId) {
            curGroup.push(cd);
          } else {
            curGroup = [cd];
            r.push(curGroup);
          }
        }
        setHistories(r);
      } else {
        setHistories([]);
      }

      setTotal(result.total);
    }
    t();
  }, [filterKey, page, limit]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  return (
    <Box p={1} sx={{ height: 'calc(100vh - 80px)' }}>
      {histories.map((group, index) => (
        <HistoryCard
          key={index}
          group={group}
          historyCallback={historyCallback}
        />
      ))}
      <Divider />
      <Pagination
        count={Math.ceil(total / limit)}
        page={page}
        size="small"
        onChange={handlePageChange}
        variant="outlined"
        color="secondary"
         sx={{ margin: '10px' }}
      />
    </Box>
  );
}

export default HistoriesUI;
