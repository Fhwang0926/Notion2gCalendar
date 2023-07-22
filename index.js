const { Client } = require("@notionhq/client");
const config = require("./config");
const moment = require("moment-timezone");
const _ = require("lodash");
// API 키를 사용하여 Notion 클라이언트 인스턴스를 생성합니다
const notion = new Client({ auth: config.YOUR_NOTION_API_KEY });
const { google } = require("googleapis");
const { authorize } = require('./google')

// 데이터베이스 ID 설정 (이 ID를 실제 데이터베이스 ID로 변경)
const DATABASE_ID = config.YOUR_DATABASE_ID;

const colum_name = "Due-date";
let depth = 0;
async function notion_worker() {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          {
            property: "메모",
            // property: 'title',
            // rich_text: '할일',
            rich_text: { contains: "test" },
          },
          {
            property: colum_name,
            date: {
              after: moment().add(-1, "d"),
            },
          },
        ],
      },
    });
    // TODO 과거 일은 할 필요가 없음, 미래 목록만 업데이트 함

    let rv = { start : '', end : '', title: '' }
    for (let key in response.results) {
      console.log(`task : ${JSON.stringify(response.results[key])}`);
      depth = 0;
      rv = await parse(response.results[key]);

      console.log(rv);
    }

    console.log((response.results || []).length);

    await google_worker(rv);
  } catch (error) {
    console.error(error);
    console.error(error.body);
    res = JSON.parse(error.body);
    console.log(`object : ${res.object}`);
    console.log(`status : ${res.status}`);
    console.log(`message : ${res.message}`);
  }
}

const parse = function (task = {}, depth = 0) {
  let _depth = depth;
  let rv = {
    start: "",
    end: "",
    title: "",
  };

  for (let key in task) {
    if (typeof task[key] == typeof {}) {
      _depth += 2;
      let rv_sub = parse(task[key], _depth);
      rv.start = rv_sub.start ? rv_sub.start : rv.start;
      rv.end = rv_sub.end ? rv_sub.end : rv.end;
      rv.title = rv_sub.title ? rv_sub.title : rv.title;
    } else {
      console.log(
        `${[...Array(_depth).keys()].map((x) => " ").join("")} ${key} : $${
          task[key]
        }`
      );
      switch (key) {
        case "start":
          rv.start = task[key];
          break;
        case "end":
          rv.end = task[key];
          break;
        case "plain_text":
          rv.title = task[key];
          break;
      }
    }

    // console.log(rv)
  }

  return rv;
};

const google_worker = async (task) => {


  const event = {
    'summary': task.title,
    'location': '800 Howard St., San Francisco, CA 94103',
    'description': 'A chance to hear more about Google\'s developer products.',
    'start': {
      'dateTime': moment(),
      'timeZone': moment.tz.guess(),
    },
    'end': {
      'dateTime': moment().add(1, 'd'),
      'timeZone': moment.tz.guess(),
    },
    'recurrence': [
      'RRULE:FREQ=DAILY;COUNT=2'
    ],
    'attendees': [
      // {'email': 'lpage@example.com'},
      // {'email': 'sbrin@example.com'},
    ],
    'reminders': {
      'useDefault': false,
      'overrides': [
        {'method': 'email', 'minutes': 24 * 60},
        {'method': 'popup', 'minutes': 10},
      ],
    },
  };
  let auth = await authorize()
  const calendar = google.calendar({version: 'v3', auth});
  
  calendar.events.insert({
    auth: auth,
    calendarId: 'primary',
    resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.htmlLink);
  });
  

  // const oauth2Client = new google.auth.OAuth2(
  //   config.YOUR_GOOGLE_CLIENT_ID,
  //   config.YOUR_GOOGLE_CLIENT_SECRET
  // );

  // oauth2Client.setCredentials({
  //   access_token: "google access token",
  //   refresh_token: "google refresh token",
  //   expiry_date: "token expiry date",
  // });

  // const calendar = google.calendar({ version: "v3", oauth2Client });

  // const event = {
  //   summary: "Test event",
  //   description: "Google add event testing.",
  //   start: {
  //     dateTime: "2021-11-28T01:00:00-07:00",
  //     timeZone: "Asia/kolkata",
  //   },
  //   end: {
  //     dateTime: "2021-11-28T05:00:00-07:00",
  //     timeZone: "Asia/Kolkata",
  //   },
  //   reminders: {
  //     useDefault: false,
  //     overrides: [
  //       { method: "email", minutes: 24 * 60 },
  //       { method: "popup", minutes: 30 },
  //     ],
  //   },
  // };

  // // We make a request to Google Calendar API.
  // return calendar.events
  //   .insert({
  //     auth: oauth2Client,
  //     calendarId: "primary",
  //     resource: event,
  //   })
  //   .then((event) => console.log("Event created: %s", event.htmlLink))
  //   .catch((error) => console.log("Some error occured", error));
};
notion_worker();
