import {defineConfig} from 'vite';

// Windows에서 편집기·Office·백신이 저장 중 만드는 임시 파일(*.tmp, ~$*, ~WRL*)이 잠긴 상태로
// 감시 대상에 잡히면 EBUSY로 dev 서버가 종료된다. 소스와 무관한 파일은 감시에서 제외한다.
export default defineConfig({
  server:{
    host:'127.0.0.1',
    port:5173,
    watch:{
      ignored:['**/*.tmp','**/~$*','**/~WRL*','**/*.swp','**/.git/**','**/node_modules/**','**/dist/**','**/*.zip','**/*.docx'],
    },
  },
});
