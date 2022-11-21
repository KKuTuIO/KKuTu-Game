# KKuTuIO-Game
##### [글자로 놀자, 끄투리오.](https://kkutu.io)
[웹 서버 소스 코드 확인하기](https://github.com/KKuTuIO/KKuTu-Web/tree/kkutuio)
> GPL 라이선스에 따라 배포되는 끄투리오의 게임 서버 소스 코드입니다.
> 
> 비 인가 프로그램 방지 시스템 등 프로젝트 외적으로 자체 개발된 일부 사항들은 포함되어있지 않을 수 있습니다.
또한, 끄투리오 내부에서만 이용 가능한 리소스가 일부 포함되어있을 수 있으니, 이용에 참고 부탁드립니다.
> 
> 본 레포지토리에서 배포되는 소스 코드에는 별도의 지원이 포함되어있지 않으며, 끄투리오에서는 본 레포지토리의 일부 또는 전체를 사용함으로써 발생하는 모든 문제에 대하여 책임지지 않습니다.
>
> 아울러, 끄투리오의 소스 코드는 기존 KKuTu 소스 코드와 달리 [Affero GPL 3.0](https://github.com/KKuTuIO/KKuTu-Game/blob/public/LICENSE)으로 배포되며, 소스 코드의 공개 및 출처 표기가 의무화되어 있습니다. 자세한 사항은 라이선스를 확인해주시기 바랍니다.

## 추가 소스 코드 이용 조항
### HTTP(S) 혹은 웹 소켓(Websocket)으로의 응답 전송 의무
**[Affero GPL 3.0](https://github.com/KKuTuIO/KKuTu-Game/blob/public/LICENSE)으로 배포되는 코드의 일부 혹은 전체를 사용하였을 경우, HTTP(S) 혹은 Websocket 프로토콜을 사용하여 최소 1회 이상 다음 응답을 JSON으로 클라이언트에게 전송해야 합니다.**
```json
{
	"includes": "KKuTuIO-Game",
	"uri": "https://kkutu.io",
	"codebase": "https://github.com/KKuTuIO/KKuTu-Game"
}
```

클라이언트에게 보내는 응답 메세지가 500개를 초과할 경우, 응답 메세지 500개를 보낼 때마다 위 메세지를 다시 전송해야 합니다.

### 애플리케이션 하단 저작권 명시 의무 
**[Affero GPL 3.0](https://github.com/KKuTuIO/KKuTu-Game/blob/public/LICENSE)으로 배포되는 코드의 일부 혹은 전체를 사용하였을 경우, 이 프로젝트를 사용하는 애플리케이션 하단에 다음과 같은 문구를 기재하여야 합니다.**

```
	글자로 놀자! 끄투 온라인. <프로젝트 이름>(은)는 JJoriping의 KKuTu를 기반으로 제작되었으며,
	끄투리오(KKuTuIO)의 KKuTu-Game 프로젝트를 기반으로 하고 있습니다.
```

문구의 의미를 해치지 않는 선에서 일부 수정은 허용됩니다.
여러 메뉴 또는 페이지가 존재하는 애플리케이션일 경우에는 모든 메뉴 혹은 페이지마다 기재하셔야 합니다.
단, 별도의 저작권 고지 페이지를 만들어 이를 링크하는 것으로 대체하는 행위는 허용됩니다.


<hr/>

- Made by [JJoriping](http://blog.jjo.kr/)
- Special thanks to
    * [샌드박스 :: SDBX](http://cafe.naver.com/sdbx)
    * [SWMaestro](http://www.swmaestro.kr)
    * You to have interested in this repository :)
- [KKuTu Wiki](https://github.com/JJoriping/KKuTu/wiki)
- [프리 서버 목록](https://kkutu.kr/kkutu)
- Languages
    * [English](#english)
    * [한국어](#한국어)

## English
> Rule the words! KKuTu Online

**KKuTu** is a casual game containing letious word games that let players use their vocabulary.
Players can play alone with a robot, or play with other players who have entered to a server.
This repository provides you what you have to prepare to play **KKuTu**.

### KKuTu Server
#### For Windows
1. Download or clone this repository to your machine.
1. Install [node.js](https://nodejs.org/en/) and npm(this will be installed automatically).
1. Install [PostgreSQL](https://www.postgresql.org/) database server and pgAdmin(this will be installed automatically).
1. Run pgAdmin and put the SQL file(`./db.sql`) into your database.
	* For further details, visit [my blog][dev-blog].
1. Run the batch file(`./server-setup.bat`).
1. Run the batch file(`./Server/run.bat`).
	* If you want to close the server, it is recommended that closing not the command prompt window, but the window generated by the command.

#### For Linux
1. Download or clone this repository to your machine.
1. Install *node.js* and *npm* via a package manager.
1. Install *PostgreSQL* database server via a package manager.
1. Put the SQL file(`./db.sql`) into your database.
	1. Run a command like: `sudo -u postgres psql --quiet main < ./db.sql`
1. Run the shell script file(`./server-setup.bat`). (It is a bat file for Windows but it will also work on Linux.)
1. Run this on working directory `./Server` in order:
	1. (Game server) `node lib/Game/cluster.js 0 1`

#### Common
- This repository contains some data from [WordNet](https://wordnet.princeton.edu/). Please provide users the license of WordNet when you operate this server.
- You should edit the file(`./Server/lib/sub/global.json`) to connect to your PostgreSQL database server.
- The host `127.0.0.2` is reserved for connections between your web server and game server.
- Once the server is successfully installed, you can do just the last step of above-mentioned guideline whenever you want to run the server.
- You can open a browser and go to `127.0.0.1`(or external IP address for other people) to play **KKuTu**.
- Ranking and some session features require [Redis](https://redis.io/) server. This is optional.
- If you use Cloudflare, you should set status of DNS Tab to 'DNS only'. 'DNS and HTTP proxy (CDN)' status is the reason of unable to open and enter the room.

#### License
- [GNU Affero General Public License](https://github.com/KKuTuIO/KKuTu-Game/blob/public/LICENSE) for all source codes not included in [JJoriping/KKuTu](https://github.com/JJoriping/KKuTu). 
	- [GNU General Public License](https://github.com/JJoriping/KKuTu/blob/master/LICENSE) for source codes included in [JJoriping/KKuTu](https://github.com/JJoriping/KKuTu).

## 한국어
> 글자로 놀자! 끄투 온라인

**끄투**는 여러분의 어휘력을 발휘할 수 있는 다양한 단어 게임들이 모여 있는 캐주얼 게임입니다.
로봇과 혼자서 게임을 할 수도 있고, 서버에 접속해 있는 다른 사람들과 함께 할 수도 있죠.
이 저장소는 여러분이 **끄투**를 즐기기 위해 준비해야 할 것들에 대해 알리고 있습니다.

### 끄투 클라이언트
- *구현되지 않음*
- 하지만 접속할 서버의 주소를 알고 있다면 웹 브라우저를 이용하여 서버에 접속할 수 있습니다!

### 끄투 서버
#### Windows 전용
1. 이 레포지토리를 내려받습니다.
1. [node.js](https://nodejs.org/ko/) 인스톨러를 내려받아 npm(자동으로 설치됨)과 함께 설치합니다.
1. [PostgreSQL](https://www.postgresql.org/) 인스톨러를 내려받아 pgAdmin(자동으로 설치됨)과 함께 설치합니다.
1. pgAdmin을 실행시키고 SQL 파일(`./db.sql`)을 데이터베이스에 입력시킵니다.
	* 자세한 과정은 [개발자 블로그][dev-blog]를 참고하세요.
1. 배치 파일(`./server-setup.bat`)을 실행시킵니다.
1. 배치 파일(`./Server/run.bat`)을 실행시킵니다.
	* 되도록 이 배치 파일을 직접 종료하지 말고 이를 실행시켜 나타나는 창을 종료하세요.

#### Linux 전용
1. 이 레포지토리를 내려받습니다.
1. 패키지 매니저를 이용하여 *node.js*와 *npm*을 설치합니다.
1. 패키지 매니저를 이용하여 *PostgreSQL*과 *psql*을 설치합니다.
1. SQL 파일(`./db.sql`)을 데이터베이스에 입력시킵니다.
	1. 명령어를 다음 예와 같이 입력할 수 있습니다: `sudo -u postgres psql --quiet main < ./db.sql`
1. 섈 스크립트 파일(`./server-setup.bat`)을 실행시킵니다. (Windows 전용 파일이지만 Linux에서도 작동합니다.)
1. 경로 `./Server`에서 다음 명령어를 실행합니다:
	1. (게임 서버) `node lib/Game/cluster.js 0 1`

#### 공통
- 본 레포지토리에는 [WordNet](https://wordnet.princeton.edu/) 자료가 포함되어 있습니다. 서버를 운영할 때 반드시 사용자에게 이에 대한 라이선스를 안내해야 합니다.
- PostgreSQL 데이터베이스 서버에 접속하기 위해서는 설정 파일(`./Server/lib/sub/global.json`)에서 `PG_PASS` 값을 수정해야 합니다.
- 호스트 `127.0.0.2`는 웹 서버와 게임 서버 사이의 연결을 위해 예약된 주소이므로 이 주소를 사용하지 말아야 합니다.
- 서버가 정상적으로 설치된 다음부터는 서버를 실행시키기 위해서 가장 마지막 단계만 수행하면 됩니다.
- 서버가 성공적으로 열린 후 웹 브라우저에서 `127.0.0.1`(다른 사람들은 해당 컴퓨터의 외부 IP 주소)로 접속하여 끄투를 즐길 수 있습니다.
- 랭킹 및 세션 기능 일부는 [Redis](https://redis.io/) 서버가 실행되어야만 작동합니다. 일단 이를 설치하지 않아도 서버가 작동할 수 있도록 조치했습니다.
- 클라우드 플레어를 사용하신다면, DNS 탭의 status를 DNS only로 두세요. DNS and HTTP proxy (CDN)으로 둘 경우, 방 만들기와 방 입장이 되지 않습니다.

#### 라이선스
- [JJoriping/KKuTu](https://github.com/JJoriping/KKuTu)에 포함되지 않은 모든 소스 코드에 대해: [GNU 아페로 일반 공중 사용 라이선스](https://github.com/KKuTuIO/KKuTu-Game/blob/public/LICENSE)
	- [JJoriping/KKuTu](https://github.com/JJoriping/KKuTu)에 포함된 모든 소스 코드에 대해: [GNU 일반 공중 사용 라이선스](https://github.com/JJoriping/KKuTu/blob/master/LICENSE)

[kkutuio]: https://kkutu.io
[kkutuio-cafe]: https://cafe.kkutu.io/kkutuio