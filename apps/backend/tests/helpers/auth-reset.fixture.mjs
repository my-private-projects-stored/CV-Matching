import User from '../../src/models/User.js';
import { createMockMailer, resetMailer, setMailer } from '../../src/services/mailer.service.js';

function cloneUser(user) {
  return {
    ...user,
    save: async function save() {
      this.updatedAt = new Date('2026-05-03T00:00:00.000Z');
      return this;
    },
  };
}

export function createAuthResetFixture() {
  const originalFindOne = User.findOne;
  const originalFindById = User.findById;
  const mailer = createMockMailer();
  const usersByEmail = new Map();
  const usersById = new Map();

  setMailer(mailer);

  User.findOne = async (query = {}) => {
    const email = String(query.email || '').trim().toLowerCase();
    return usersByEmail.get(email) || null;
  };

  User.findById = async (id) => usersById.get(String(id)) || null;

  function seedUser({ id, email, passwordResetVersion = 0, password = '$2a$10$fixture.fixture.fixture.fixture.fixture.fixture.fixture.fi', fullName = 'Fixture User' } = {}) {
    const user = cloneUser({
      _id: id,
      email: String(email).trim().toLowerCase(),
      password,
      fullName,
      passwordResetVersion,
      updatedAt: new Date('2026-05-03T00:00:00.000Z'),
    });

    usersByEmail.set(user.email, user);
    usersById.set(String(id), user);
    return user;
  }

  async function cleanup() {
    User.findOne = originalFindOne;
    User.findById = originalFindById;
    resetMailer();
    usersByEmail.clear();
    usersById.clear();
  }

  return {
    mailer,
    seedUser,
    cleanup,
  };
}