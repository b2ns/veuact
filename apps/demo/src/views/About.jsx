import Hello from '../components/Hello';
import { ref } from 'vueact';

export default () => {
  const name = ref('');

  return () => (
    <div class="main-page">
      <h3>about page</h3>
      <Hello name={name.value} />
      <p>
        <input type="text" onInput={(e) => (name.value = e.target.value)} />
      </p>
    </div>
  );
};
